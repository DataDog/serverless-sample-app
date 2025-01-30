/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.container.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.container.core.Product;
import com.product.api.container.core.ProductPriceBracket;
import com.product.api.container.core.ProductRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class ProductRepositoryImpl implements ProductRepository {
    private final DynamoDbClient dynamoDB;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(ProductRepositoryImpl.class);
    private static final String PARTITION_KEY = "PK";
    private static final String PRODUCT_ID_KEY = "ProductId";
    private static final String NAME_KEY = "Name";
    private static final String CURRENT_STOCK_LEVEL_KEY = "CurrentStockLevel";
    private static final String PRICE_KEY = "Price";
    private static final String TYPE_KEY = "Type";
    private static final String PRICE_BRACKET_KEY = "PriceBrackets";

    public ProductRepositoryImpl(DynamoDbClient dynamoDB, ObjectMapper mapper) {
        this.dynamoDB = dynamoDB;
        this.mapper = mapper;
    }

    @Override
    public List<Product> listProducts() {
        ScanRequest request = ScanRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .build();

        var scanResult = dynamoDB.scan(request);

        ArrayList<Product> products = new ArrayList<>();

        for (Map<String, AttributeValue> item : scanResult.items()) {
            if (item.isEmpty() || !item.containsKey(NAME_KEY)) {
                return null;
            }

            try {
                String priceBracketString = item.get(PRICE_BRACKET_KEY).s();

                logger.info(priceBracketString);

                List<ProductPriceBracket> brackets = this.mapper.readValue(priceBracketString, new TypeReference<>() {});

                products.add(new Product(item.get(PARTITION_KEY).s(), item.get(NAME_KEY).s(), Double.parseDouble(item.get(PRICE_KEY).n()), Double.parseDouble(item.get(CURRENT_STOCK_LEVEL_KEY).n()), brackets));
            }
            catch (JsonProcessingException error){
                logger.error("An exception occurred!", error);
                products.add(new Product(item.get(PARTITION_KEY).s(), item.get(NAME_KEY).s(), Double.parseDouble(item.get(PRICE_KEY).n()), Double.parseDouble(item.get(CURRENT_STOCK_LEVEL_KEY).n()), List.of()));
            }
        }

        return products;
    }

    @Override
    public Product getProduct(String productId) {
        HashMap<String, AttributeValue> key = new HashMap<>();
        key.put(PARTITION_KEY, AttributeValue.fromS(productId));

        GetItemRequest request = GetItemRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .key(key)
                .build();

        var result = dynamoDB.getItem(request);

        Map<String, AttributeValue> item = result.item();

        if (item.isEmpty() || !item.containsKey(NAME_KEY)) {
            return null;
        }

        try {
            String priceBracketString = item.get(PRICE_BRACKET_KEY).s();

            logger.info(priceBracketString);

            List<ProductPriceBracket> brackets = this.mapper.readValue(priceBracketString, new TypeReference<>() {});

            return new Product(item.get(PARTITION_KEY).s(), item.get(NAME_KEY).s(), Double.parseDouble(item.get(PRICE_KEY).n()), Double.parseDouble(item.get(CURRENT_STOCK_LEVEL_KEY).n()), brackets);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            return new Product(item.get(PARTITION_KEY).s(), item.get(NAME_KEY).s(), Double.parseDouble(item.get(PRICE_KEY).n()), Double.parseDouble(item.get(CURRENT_STOCK_LEVEL_KEY).n()), List.of());
        }
    }

    @Override
    public Product createProduct(Product product) throws JsonProcessingException {
        HashMap<String, AttributeValue> item =
                new HashMap<>();
        item.put(PARTITION_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(TYPE_KEY, AttributeValue.fromS("Product"));
        item.put(PRODUCT_ID_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(NAME_KEY, AttributeValue.fromS(product.getName()));
        item.put(PRICE_KEY, AttributeValue.fromN(product.getPrice().toString()));
        item.put(CURRENT_STOCK_LEVEL_KEY, AttributeValue.fromN(product.getCurrentStockLevel().toString()));
        item.put(PRICE_BRACKET_KEY, AttributeValue.fromS(this.mapper.writeValueAsString(product.getPriceBrackets())));

        PutItemRequest putItemRequest = PutItemRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .item(item)
                .build();

        this.dynamoDB.putItem(putItemRequest);

        return product;
    }

    @Override
    public Product updateProduct(Product product) throws JsonProcessingException {
        HashMap<String, AttributeValue> item =
                new HashMap<>();
        item.put(PARTITION_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(TYPE_KEY, AttributeValue.fromS("Product"));
        item.put(PRODUCT_ID_KEY, AttributeValue.fromS(product.getProductId()));
        item.put(NAME_KEY, AttributeValue.fromS(product.getName()));
        item.put(PRICE_KEY, AttributeValue.fromN(product.getPrice().toString()));
        item.put(CURRENT_STOCK_LEVEL_KEY, AttributeValue.fromN(product.getCurrentStockLevel().toString()));
        item.put(PRICE_BRACKET_KEY, AttributeValue.fromS(this.mapper.writeValueAsString(product.getPriceBrackets())));

        PutItemRequest putItemRequest = PutItemRequest.builder()
                .tableName(System.getenv("TABLE_NAME"))
                .item(item)
                .build();

        this.dynamoDB.putItem(putItemRequest);

        return product;
    }

    @Override
    public boolean deleteProduct(String productId) {
        try{
            HashMap<String, AttributeValue> key = new HashMap<>();
            key.put(PARTITION_KEY, AttributeValue.fromS(productId));

            DeleteItemRequest deleteItemRequest = DeleteItemRequest.builder()
                    .tableName(System.getenv("TABLE_NAME"))
                    .conditionExpression("attribute_exists(ProductId)")
                    .key(key)
                    .build();

            this.dynamoDB.deleteItem(deleteItemRequest);

            return true;
        }
        catch (ConditionalCheckFailedException error) {
            this.logger.warn("Attempted to delete a product that does not exist");

            return false;
        }
    }
}