/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.container.core;

import java.util.ArrayList;
import java.util.List;

public class CreateProductRequest {
    private String name;
    private Double price;

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
    
    public List<String> validate() {
        List<String> validationResponse = new ArrayList<>();
        if (this.price <= 0) {
            validationResponse.add("Price must be greater than 0");
        }
        
        if (this.name == null || this.name.length() <= 3) {
            validationResponse.add("Name must be at least 3 characters");
        }
        
        return validationResponse;
    }
}
