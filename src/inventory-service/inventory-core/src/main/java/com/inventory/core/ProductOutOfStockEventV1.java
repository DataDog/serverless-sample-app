/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductOutOfStockEventV1 {
    private final String productId;

    public ProductOutOfStockEventV1(){
        this.productId = "";
    }

    public ProductOutOfStockEventV1(String productId) {
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
