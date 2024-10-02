/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.core;

import java.util.List;

public class ProductDTO {
    private final String productId;
    private final String name;
    private final Double price;
    private final List<ProductPriceBracket> pricingBrackets;

    public ProductDTO(Product product) {
        this.productId = product.getProductId();
        this.name = product.getName();
        this.price = product.getPrice();
        this.pricingBrackets = product.getPriceBrackets();
    }

    public List<ProductPriceBracket> getPricingBrackets() {
        return pricingBrackets;
    }

    public Double getPrice() {
        return price;
    }

    public String getName() {
        return name;
    }

    public String getProductId() {
        return productId;
    }
}
