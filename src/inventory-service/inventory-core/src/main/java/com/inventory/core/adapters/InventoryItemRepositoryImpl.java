/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.adapters;

import com.inventory.core.DataAccessException;
import com.inventory.core.InventoryItem;
import com.inventory.core.InventoryItemNotFoundException;
import com.inventory.core.InventoryItemRepository;
import com.inventory.core.StaleItemException;
import com.inventory.core.config.AppConfig;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.context.Context;
import io.quarkus.cache.CacheInvalidateAll;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class InventoryItemRepositoryImpl implements InventoryItemRepository {
    private final DynamoDbClient dynamoDB;
    private final AppConfig appConfig;
    private final InventoryItemCache cache;
    private final Logger logger = LoggerFactory.getLogger(InventoryItemRepositoryImpl.class);
    private static final String PARTITION_KEY = "PK";
    private static final String PRODUCT_ID_KEY = "productId";
    private static final String STOCK_LEVEL_KEY = "stockLevel";
    private static final String RESERVED_STOCK_LEVEL_KEY = "reservedStockLevel";
    private static final String RESERVED_STOCK_ORDERS_KEY = "stockOrders";
    private static final String TYPE_KEY = "Type";
    private static final String VERSION_KEY = "itemVersion";

    @Inject
    public InventoryItemRepositoryImpl(DynamoDbClient dynamoDB, AppConfig appConfig, InventoryItemCache cache) {
        this.dynamoDB = dynamoDB;
        this.appConfig = appConfig;
        this.cache = cache;
    }

    @Override
    public InventoryItem withProductId(String productId) throws DataAccessException, InventoryItemNotFoundException {
        // The cache holds a single canonical instance per productId. Return a
        // defensive copy so callers that mutate the item (reserve/release stock)
        // cannot corrupt the shared cached object across concurrent requests.
        InventoryItem cached = cache.load(productId);
        return new InventoryItem(cached);
    }

    @Override
    public void update(InventoryItem product) throws DataAccessException  {
        final Span span = Span.fromContext(Context.current());
        if (span.getSpanContext().isValid()) {
            span.setAttribute("cache.inventory.operation", "invalidate");
            span.setAttribute("product.id", product.getProductId());
        }

        long currentVersion = product.getVersion();
        product.incrementVersion();

        HashMap<String, AttributeValue> item = new HashMap<>();
        item.put(PARTITION_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(TYPE_KEY, AttributeValue.fromS("InventoryItem"));
        item.put(PRODUCT_ID_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(STOCK_LEVEL_KEY, AttributeValue.fromN(product.getCurrentStockLevel().toString()));
        item.put(RESERVED_STOCK_LEVEL_KEY, AttributeValue.fromN(product.getReservedStockLevel().toString()));
        item.put(RESERVED_STOCK_ORDERS_KEY, AttributeValue.fromSs(product.getReservedStockOrders()));
        item.put(VERSION_KEY, AttributeValue.fromN(Long.toString(product.getVersion())));

        HashMap<String, AttributeValue> expressionValues = new HashMap<>();
        expressionValues.put(":expectedVersion", AttributeValue.fromN(Long.toString(currentVersion)));

        String conditionExpression;
        if (currentVersion == 0) {
            conditionExpression = "attribute_not_exists(" + VERSION_KEY + ") OR " + VERSION_KEY + " = :expectedVersion";
        } else {
            conditionExpression = VERSION_KEY + " = :expectedVersion";
        }

        PutItemRequest putItemRequest = PutItemRequest.builder()
                .tableName(appConfig.getTableName())
                .item(item)
                .conditionExpression(conditionExpression)
                .expressionAttributeValues(expressionValues)
                .returnConsumedCapacity(ReturnConsumedCapacity.TOTAL)
                .build();
        try {

            var response = this.dynamoDB.putItem(putItemRequest);

            if (span.getSpanContext().isValid()) {
                var consumedCapacity = response.consumedCapacity();
                if (consumedCapacity != null) {
                    Double wcu = consumedCapacity.writeCapacityUnits();
                    Double rcu = consumedCapacity.readCapacityUnits();
                    span.setAttribute("db.wcu", wcu != null ? wcu : 0.0);
                    span.setAttribute("db.rcu", rcu != null ? rcu : 0.0);
                }
                span.setAttribute("product.found", true);
            }
            logger.info("Updated inventory item in DynamoDB: {} (version {} -> {})",
                    product.getProductId(), currentVersion, product.getVersion());
        }
        catch (ConditionalCheckFailedException e) {
            // Revert the version increment since the write did not succeed
            product.setVersion(currentVersion);
            logger.warn("Optimistic lock conflict for item {}: expected version {}",
                    product.getProductId(), currentVersion);
            throw new StaleItemException(product.getProductId(), e);
        }
        catch (AwsServiceException |
            SdkClientException e) {
            logger.error("An error occurred while accessing DynamoDB: {}", e.getMessage(), e);
            throw new DataAccessException(e);
        }
        finally {
            // Invalidate by productId so the next read reloads fresh state. The
            // previous @CacheInvalidate keyed on the InventoryItem argument, which
            // never matched the productId key used to populate the cache, leaving
            // stale entries for up to the TTL.
            cache.invalidate(product.getProductId());
        }
    }
    
    @CacheInvalidateAll(cacheName = "inventory-cache")
    public void clearCache() {
        logger.info("Clearing inventory cache");
    }
}
