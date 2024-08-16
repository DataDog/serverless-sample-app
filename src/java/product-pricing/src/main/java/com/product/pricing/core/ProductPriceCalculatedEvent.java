/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.pricing.core;

import java.util.HashMap;

public class ProductPriceCalculatedEvent {
    private final String productId;
    private final HashMap<Double, Double> priceBrackets;

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
