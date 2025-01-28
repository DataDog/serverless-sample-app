/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.core;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class Product {
    private String productId;
    private String name;
    private Double price;
    private Double currentStockLevel;
    private String previousName;
    private Double previousPrice;
    private List<ProductPriceBracket> priceBrackets;
    private boolean updated;

    public Product() {
        this.productId = "";
        this.name = "";
        this.price = -1.0;
        this.currentStockLevel = -1.0;
        this.priceBrackets = new ArrayList<>(0);
    }

    public Product(String productId, String name, Double price, Double currentStockLevel, List<ProductPriceBracket> priceBrackets) {
        this.productId = productId;
        this.name = name;
        this.price = price;
        this.priceBrackets = priceBrackets;
        this.currentStockLevel = currentStockLevel;
    }

    static Product Create(String name, Double price) {
        Product product = new Product();
        product.productId = UUID.randomUUID().toString();
        product.name = name;
        product.price = price;
        return product;
    }

    public String getProductId() {
        return productId;
    }

    public String getName() {
        return name;
    }

    public Double getPrice() {
        return price;
    }

    public List<ProductPriceBracket> getPriceBrackets() {
        return this.priceBrackets;
    }

    public void update(String name, Double price) {
        if (!this.name.equals(name)) {
            this.previousName = this.name;
            this.name = name;
            this.updated = true;
        }

        if (!this.price.equals(price)) {
            this.previousPrice = this.price;
            this.price = price;
            this.updated = true;
        }
    }

    public void clearPricing() {
        this.priceBrackets = new ArrayList<>();
    }

    public void addPrice(ProductPriceBracket bracket) {
        this.priceBrackets.add(bracket);
    }

    public void updateCurrentStockLevel(Double newStockLevel) {
        if (newStockLevel < 0) {
            currentStockLevel = 0.0;
            return;
        }

        currentStockLevel = newStockLevel;
    }

    public boolean isUpdated() {
        return updated;
    }

    public String getPreviousName() {
        return previousName;
    }

    public Double getPreviousPrice() {
        return this.previousPrice;
    }

    public Double getCurrentStockLevel() {
        return currentStockLevel;
    }
}
