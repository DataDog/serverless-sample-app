/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class InventoryStockUpdatedEvent {
    private final String productId;
    private final Double previousStockLevel;
    private final Double newStockLevel;

    public InventoryStockUpdatedEvent(){
        this.productId = "";
        this.previousStockLevel = -1.0;
        this.newStockLevel = -1.0;
    }

    public InventoryStockUpdatedEvent(String productId, Double previousStockLevel, Double newStockLevel) {
        this.productId = productId;
        this.previousStockLevel = previousStockLevel;
        this.newStockLevel = newStockLevel;
    }

    public String getProductId() {
        return productId;
    }

    public Double getPreviousStockLevel() {
        return previousStockLevel;
    }

    public Double getNewStockLevel() {
        return newStockLevel;
    }
}
