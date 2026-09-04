/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.adapters;

import com.inventory.core.DataAccessException;
import com.inventory.core.InventoryItem;
import com.inventory.core.InventoryItemNotFoundException;
import com.inventory.core.config.AppConfig;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.context.Context;
import io.quarkus.cache.CacheInvalidate;
import io.quarkus.cache.CacheResult;
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

/**
 * Owns the cached DynamoDB read for inventory items.
 *
 * <p>The cached instance returned by {@link #load(String)} is the single
 * canonical object stored in the "inventory-cache". Callers must NEVER mutate
 * it — the repository wraps every read in a defensive copy so that concurrent
 * reservations cannot corrupt the shared cached object. Keeping the caching in
 * a dedicated bean guarantees the {@code @CacheResult} method is always invoked
 * through the CDI proxy.
 */
@ApplicationScoped
public class InventoryItemCache {
    private final DynamoDbClient dynamoDB;
    private final AppConfig appConfig;
    private final Logger logger = LoggerFactory.getLogger(InventoryItemCache.class);
    private static final String PARTITION_KEY = "PK";
    private static final String PRODUCT_ID_KEY = "productId";
    private static final String STOCK_LEVEL_KEY = "stockLevel";
    private static final String RESERVED_STOCK_LEVEL_KEY = "reservedStockLevel";
    private static final String RESERVED_STOCK_ORDERS_KEY = "stockOrders";
    private static final String VERSION_KEY = "itemVersion";

    @Inject
    public InventoryItemCache(DynamoDbClient dynamoDB, AppConfig appConfig) {
        this.dynamoDB = dynamoDB;
        this.appConfig = appConfig;
    }

    @CacheResult(cacheName = "inventory-cache")
    public InventoryItem load(String productId) throws DataAccessException, InventoryItemNotFoundException {
        final Span span = Span.fromContext(Context.current());
        if (span.getSpanContext().isValid()) {
            span.setAttribute("cache.inventory.operation", "get");
            span.setAttribute("product.id", productId);
        }

        HashMap<String, AttributeValue> key = new HashMap<>();
        key.put(PARTITION_KEY, AttributeValue.fromS(productId));

        GetItemRequest request = GetItemRequest.builder()
                .tableName(appConfig.getTableName())
                .returnConsumedCapacity(ReturnConsumedCapacity.TOTAL)
                .key(key)
                .build();

        logger.info("Fetching inventory item from DynamoDB for productId: {}", productId);

        try {
            var result = dynamoDB.getItem(request);

            Map<String, AttributeValue> item = result.item();

            if (item.isEmpty() || !item.containsKey(PRODUCT_ID_KEY)) {
                if (span.getSpanContext().isValid()) {
                    span.setAttribute("product.found", false);
                }
                throw new InventoryItemNotFoundException(productId);
            }

            if (span.getSpanContext().isValid()) {
                var consumedCapacity = result.consumedCapacity();
                if (consumedCapacity != null) {
                    Double wcu = consumedCapacity.writeCapacityUnits();
                    Double rcu = consumedCapacity.readCapacityUnits();
                    span.setAttribute("db.wcu", wcu != null ? wcu : 0.0);
                    span.setAttribute("db.rcu", rcu != null ? rcu : 0.0);
                }
                span.setAttribute("product.found", true);
            }

            ArrayList<String> orders = new ArrayList<>(item.get(RESERVED_STOCK_ORDERS_KEY).ss());
            long version = item.containsKey(VERSION_KEY)
                    ? Long.parseLong(item.get(VERSION_KEY).n())
                    : 0;
            return new InventoryItem(
                    item.get(PARTITION_KEY).s(),
                    Double.parseDouble(item.get(STOCK_LEVEL_KEY).n()),
                    Double.parseDouble(item.get(RESERVED_STOCK_LEVEL_KEY).n()),
                    orders,
                    version
            );
        }
        catch (AwsServiceException |
               SdkClientException e) {
            logger.error("An error occurred while accessing DynamoDB: {}", e.getMessage(), e);
            throw new DataAccessException(e);
        }
    }

    @CacheInvalidate(cacheName = "inventory-cache")
    public void invalidate(String productId) {
        logger.info("Invalidating inventory cache for productId: {}", productId);
    }
}
