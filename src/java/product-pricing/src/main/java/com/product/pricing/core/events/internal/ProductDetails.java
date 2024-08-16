/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.pricing.core.events.internal;

public class ProductDetails {
    private final String name;
    private final Double price;
    
    public ProductDetails(){
        this.name = "";
        this.price = -1.0;
    }

    public ProductDetails(String name, Double price) {
        this.name = name;
        this.price = price;
    }

    public String getName() {
        return name;
    }

    public Double getPrice() {
        return price;
    }
}
