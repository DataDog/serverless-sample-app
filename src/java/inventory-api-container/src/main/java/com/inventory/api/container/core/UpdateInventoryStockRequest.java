/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.api.container.core;

import java.util.ArrayList;
import java.util.List;

public class UpdateInventoryStockRequest {
    private String productId;
    private Double stockLevel;
    
    public List<String> validate() {
        List<String> validationResponse = new ArrayList<>();
        if (this.stockLevel <= 0) {
            validationResponse.add("Price must be greater than 0");
        }
        
        if (this.productId == null || this.productId.length() <= 3) {
            validationResponse.add("ProductID must be at least 3 characters");
        }
        
        return validationResponse;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public Double getStockLevel() {
        return stockLevel;
    }

    public void setStockLevel(Double stockLevel) {
        this.stockLevel = stockLevel;
    }
}
