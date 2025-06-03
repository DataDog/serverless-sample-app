/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.HashMap;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductPriceCalculatedEvent {
    private final String productId;
    private final HashMap<Double, Double> priceBrackets;

    public ProductPriceCalculatedEvent(){
        this.productId = "";
        this.priceBrackets = new HashMap<>();
    }

    public ProductPriceCalculatedEvent(String productId, HashMap<Double, Double> priceBrackets) {
        this.productId = productId;
        this.priceBrackets = priceBrackets;
    }

    public HashMap<Double, Double> getPriceBrackets() {
        return priceBrackets;
    }

    public String getProductId() {
        return productId;
    }
}

