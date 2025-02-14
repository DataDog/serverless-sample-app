/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.acl.core.events.external;

public class ProductCreatedEventV1 {
    private String productId;
    
    public ProductCreatedEventV1(){}
    
    public ProductCreatedEventV1(String productId){
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
