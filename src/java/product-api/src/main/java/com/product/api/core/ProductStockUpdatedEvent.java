/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.core;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductStockUpdatedEvent {
    private final String productId;
    private final Double newStockLevel;

    public ProductStockUpdatedEvent(){
        this.productId = "";
        this.newStockLevel = -1.0;
    }

    public ProductStockUpdatedEvent(String productId, Double newStockLevel) {
        this.productId = productId;
        this.newStockLevel = newStockLevel;
    }

    public String getProductId() {
        return productId;
    }

    public Double getNewStockLevel() {
        return newStockLevel;
    }
}
