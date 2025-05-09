/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.adapters;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.core.OrderCache;
import com.inventory.core.config.AppConfig;
import io.opentracing.Span;
import io.opentracing.util.GlobalTracer;
import io.quarkus.cache.CacheResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.ReturnConsumedCapacity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class OrderCacheImpl implements OrderCache {
    private final DynamoDbClient dynamoDB;
    private final ObjectMapper mapper;
    private final AppConfig appConfig;
    private final Logger logger = LoggerFactory.getLogger(OrderCacheImpl.class);
    private static final String PARTITION_KEY = "PK";
    private static final String TYPE_KEY = "Type";
    private static final String PRODUCTS_KEY = "Products";

    @Inject
    public OrderCacheImpl(DynamoDbClient dynamoDB, ObjectMapper mapper, AppConfig appConfig) {
        this.dynamoDB = dynamoDB;
        this.mapper = mapper;
        this.appConfig = appConfig;
    }

    @Override
    @CacheResult(cacheName = "order-cache")
    public ArrayList<String> products(String orderId) {
        final Span span = GlobalTracer.get().activeSpan();
        if (span != null) {
            span.setTag("table.name", appConfig.getTableName());
            span.setTag("order.id", orderId);
        }

        HashMap<String, AttributeValue> key = new HashMap<>();
        key.put(PARTITION_KEY, AttributeValue.fromS(String.format("ORDER_%s", orderId)));

        GetItemRequest request = GetItemRequest.builder()
                .tableName(appConfig.getTableName())
                .key(key)
                .returnConsumedCapacity(ReturnConsumedCapacity.TOTAL)
                .build();

        try {
            var result = dynamoDB.getItem(request);
            Map<String, AttributeValue> item = result.item();

            if (item.isEmpty() || !item.containsKey(PRODUCTS_KEY)) {
                logger.warn("Order not found: {}", orderId);
                if (span != null) {
                    span.setTag("order.found", false);
                }
                return new ArrayList<>();
            }

            if (span != null) {
                span.setTag("order.found", true);
                if (result.consumedCapacity() != null) {
                    span.setTag("db.rcu", result.consumedCapacity().readCapacityUnits());
                }
            }
            logger.info("Order found: {}", orderId);

            return new ArrayList<>(item.get(PRODUCTS_KEY).ss());
        } catch (Exception e) {
            logger.error("Error retrieving order products from DynamoDB", e);
            if (span != null) {
                span.setTag("error", true);
                span.setTag("error.message", e.getMessage());
            }
            return new ArrayList<>();
        }
    }

    @Override
    public void store(String orderId, ArrayList<String> products) {
        final Span span = GlobalTracer.get().activeSpan();
        if (span != null) {
            span.setTag("table.name", appConfig.getTableName());
            span.setTag("order.id", orderId);
            span.setTag("order.products.count", products.size());
        }

        HashMap<String, AttributeValue> item = new HashMap<>();
        item.put(PARTITION_KEY, AttributeValue.fromS(String.format("ORDER_%s", orderId)));
        item.put(TYPE_KEY, AttributeValue.fromS("Orders"));
        item.put(PRODUCTS_KEY, AttributeValue.fromSs(products));

        PutItemRequest putItemRequest = PutItemRequest.builder()
                .tableName(appConfig.getTableName())
                .item(item)
                .returnConsumedCapacity(ReturnConsumedCapacity.TOTAL)
                .build();

        try {
            var response = this.dynamoDB.putItem(putItemRequest);
            logger.info("Stored order in DynamoDB: {}", orderId);
            
            if (span != null && response.consumedCapacity() != null) {
                span.setTag("db.wcu", response.consumedCapacity().writeCapacityUnits());
            }
        } catch (Exception e) {
            logger.error("Error storing order in DynamoDB", e);
            if (span != null) {
                span.setTag("error", true);
                span.setTag("error.message", e.getMessage());
            }
            throw e;
        }
    }
}
