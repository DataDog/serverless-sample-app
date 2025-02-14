/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.api.adapters;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.api.core.InventoryItem;
import com.inventory.api.core.InventoryItemRepository;

import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class InventoryItemRepositoryImpl implements InventoryItemRepository {
    private final DynamoDbClient dynamoDB;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(InventoryItemRepositoryImpl.class);
    private static final String PARTITION_KEY = "PK";
    private static final String PRODUCT_ID_KEY = "productId";
    private static final String STOCK_LEVEL_KEY = "stockLevel";
    private static final String TYPE_KEY = "Type";

    public InventoryItemRepositoryImpl(DynamoDbClient dynamoDB, ObjectMapper mapper) {
        this.dynamoDB = dynamoDB;
        this.mapper = mapper;
    }

    @Override
    public InventoryItem withProductId(String productId) {
        HashMap<String, AttributeValue> key = new HashMap<>();
        key.put(PARTITION_KEY, AttributeValue.fromS(productId));
        
        GetItemRequest request = GetItemRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .key(key)
                .build();

        var result = dynamoDB.getItem(request);

        Map<String, AttributeValue> item = result.item();
        
        if (item.isEmpty() || !item.containsKey(PRODUCT_ID_KEY)) {
            return null;
        }

        return new InventoryItem(item.get(PARTITION_KEY).s(), Double.parseDouble(item.get(STOCK_LEVEL_KEY).n()));
    }

    @Override
    public void update(InventoryItem product) {
        HashMap<String, AttributeValue> item =
                new HashMap<>();
        item.put(PARTITION_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(TYPE_KEY, AttributeValue.fromS("InventoryItem"));
        item.put(PRODUCT_ID_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(STOCK_LEVEL_KEY, AttributeValue.fromN(product.getCurrentStockLevel().toString()));

        PutItemRequest putItemRequest = PutItemRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .item(item)
                .build();

        this.dynamoDB.putItem(putItemRequest);

        return;
    }
}
