/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.api.core;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public class InventoryItem {
    private String productId;
    private Double currentStockLevel;

    public InventoryItem() {
        this.productId = "";
        this.currentStockLevel = -1.0;
    }

    public InventoryItem(String productId, Double currentStockLevel) {
        this.productId = productId;
        this.currentStockLevel = currentStockLevel;
    }

    static InventoryItem Create(String productId, Double currentStockLevel) {
        InventoryItem inventoryItem = new InventoryItem();
        inventoryItem.productId = productId;
        inventoryItem.currentStockLevel = currentStockLevel;
        return inventoryItem;
    }

    public String getProductId() {
        return productId;
    }

    public Double getCurrentStockLevel() {
        return currentStockLevel;
    }

    public void setCurrentStockLevel(Double currentStockLevel) {
        this.currentStockLevel = currentStockLevel;
    }
}
