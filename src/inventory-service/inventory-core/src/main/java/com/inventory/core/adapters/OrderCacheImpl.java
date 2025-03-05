/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.adapters;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.core.InventoryItem;
import com.inventory.core.InventoryItemRepository;
import com.inventory.core.OrderCache;
import io.opentracing.Span;
import io.opentracing.util.GlobalTracer;
import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class OrderCacheImpl implements OrderCache {
    private final DynamoDbClient dynamoDB;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(OrderCacheImpl.class);
    private static final String PARTITION_KEY = "PK";
    private static final String TYPE_KEY = "Type";
    private static final String PRODUCTS_KEY = "Products";

    public OrderCacheImpl(DynamoDbClient dynamoDB, ObjectMapper mapper) {
        this.dynamoDB = dynamoDB;
        this.mapper = mapper;
    }

    @Override
    public ArrayList<String> products(String orderId) {
        final Span span = GlobalTracer.get().activeSpan();
        span.setTag("table.name", System.getenv("TABLE_NAME"));

        HashMap<String, AttributeValue> key = new HashMap<>();
        key.put(PARTITION_KEY, AttributeValue.fromS(String.format("ORDER_%s", orderId)));

        GetItemRequest request = GetItemRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .key(key)
                .build();

        var result = dynamoDB.getItem(request);

        Map<String, AttributeValue> item = result.item();

        if (item.isEmpty() || !item.containsKey(PRODUCTS_KEY)) {
            logger.warn("Order not found");
            span.setTag("order.found", false);
            return null;
        }

        span.setTag("order.found", false);
        logger.info("Order found");

        ArrayList<String> products = new ArrayList<>(item.get(PRODUCTS_KEY).ss());
        return products;
    }

    @Override
    public void store(String orderId, ArrayList<String> products) {
        HashMap<String, AttributeValue> item =
                new HashMap<>();
        item.put(PARTITION_KEY, AttributeValue.fromS(String.format("ORDER_%s", orderId)));
        item.put(TYPE_KEY, AttributeValue.fromS("Orders"));
        item.put(PRODUCTS_KEY, AttributeValue.fromSs(products));

        PutItemRequest putItemRequest = PutItemRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .item(item)
                .build();

        this.dynamoDB.putItem(putItemRequest);
    }
}
