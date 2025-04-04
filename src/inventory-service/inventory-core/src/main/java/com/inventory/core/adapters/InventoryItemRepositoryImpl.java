/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.adapters;

import com.inventory.core.InventoryItem;
import com.inventory.core.InventoryItemRepository;

import io.opentracing.Span;
import io.opentracing.util.GlobalTracer;
import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class InventoryItemRepositoryImpl implements InventoryItemRepository {
    private final DynamoDbClient dynamoDB;
    private final Logger logger = LoggerFactory.getLogger(InventoryItemRepositoryImpl.class);
    private static final String PARTITION_KEY = "PK";
    private static final String PRODUCT_ID_KEY = "productId";
    private static final String STOCK_LEVEL_KEY = "stockLevel";
    private static final String RESERVED_STOCK_LEVEL_KEY = "reservedStockLevel";
    private static final String RESERVED_STOCK_ORDERS_KEY = "stockOrders";
    private static final String TYPE_KEY = "Type";

    public InventoryItemRepositoryImpl(DynamoDbClient dynamoDB) {
        this.dynamoDB = dynamoDB;
    }

    @Override
    public InventoryItem withProductId(String productId) {
        final Span span = GlobalTracer.get().activeSpan();

        HashMap<String, AttributeValue> key = new HashMap<>();
        key.put(PARTITION_KEY, AttributeValue.fromS(productId));
        
        GetItemRequest request = GetItemRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .returnConsumedCapacity(ReturnConsumedCapacity.TOTAL)
                .key(key)
                .build();

        logger.info("Sending request");

        var result = dynamoDB.getItem(request);

        Map<String, AttributeValue> item = result.item();
        
        if (item.isEmpty() || !item.containsKey(PRODUCT_ID_KEY)) {
            span.setTag("product.found", false);
            return null;
        }

        span.setTag("db.wcu", result.consumedCapacity().writeCapacityUnits());
        span.setTag("db.rcu", result.consumedCapacity().readCapacityUnits());
        span.setTag("product.found", true);

        ArrayList<String> orders = new ArrayList<>(item.get(RESERVED_STOCK_ORDERS_KEY).ss());
        return new InventoryItem(item.get(PARTITION_KEY).s(), Double.parseDouble(item.get(STOCK_LEVEL_KEY).n()), Double.parseDouble(item.get(RESERVED_STOCK_LEVEL_KEY).n()), orders);
    }

    @Override
    public void update(InventoryItem product) {
        final Span span = GlobalTracer.get().activeSpan();

        HashMap<String, AttributeValue> item =
                new HashMap<>();
        item.put(PARTITION_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(TYPE_KEY, AttributeValue.fromS("InventoryItem"));
        item.put(PRODUCT_ID_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(STOCK_LEVEL_KEY, AttributeValue.fromN(product.getCurrentStockLevel().toString()));
        item.put(RESERVED_STOCK_LEVEL_KEY, AttributeValue.fromN(product.getReservedStockLevel().toString()));
        item.put(RESERVED_STOCK_ORDERS_KEY, AttributeValue.fromSs(product.getReservedStockOrders()));

        PutItemRequest putItemRequest = PutItemRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .item(item)
                .returnConsumedCapacity(ReturnConsumedCapacity.TOTAL)
                .build();

        var response = this.dynamoDB.putItem(putItemRequest);

        span.setTag("db.wcu", response.consumedCapacity().writeCapacityUnits());
        span.setTag("db.rcu", response.consumedCapacity().readCapacityUnits());
        span.setTag("product.found", true);
    }
}
