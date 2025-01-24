/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.container.core;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.product.api.container.core.ProductDetails;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductUpdatedEvent {
    private final String productId;
    private final ProductDetails previous;
    private final ProductDetails updated;

    public ProductUpdatedEvent(){
        this.productId = "";
        this.previous = new ProductDetails();
        this.updated = new ProductDetails(); 
    }

    public ProductUpdatedEvent(String productId, ProductDetails previousDetails, ProductDetails newDetails) {
        this.productId = productId;
        this.previous = previousDetails;
        this.updated = newDetails;
    }

    public String getProductId() {
        return productId;
    }

    public ProductDetails getPrevious() {
        return previous;
    }

    public ProductDetails getUpdated() {
        return updated;
    }
}
