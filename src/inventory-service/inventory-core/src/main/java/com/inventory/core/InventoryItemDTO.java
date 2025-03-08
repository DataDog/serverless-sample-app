/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

public class InventoryItemDTO {

    private final String productId;
    private final Double currentStockLevel;
    private final Double reservedStockLevel;

    public InventoryItemDTO(InventoryItem item) {
        this.productId = item.getProductId();
        this.currentStockLevel = item.getAvailableStockLevel();
        this.reservedStockLevel = item.getReservedStockLevel();
    }

    public String getProductId() {
        return productId;
    }

    public Double getCurrentStockLevel() {
        return currentStockLevel;
    }

    public Double getReservedStockLevel() {
        return reservedStockLevel;
    }
}
