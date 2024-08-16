/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.publisher.core.events.external;

import io.opentracing.Span;

import java.io.Serializable;

public class ProductDeletedEventV1 extends TracedEvent implements Serializable {
    private final String productId;
    
    public ProductDeletedEventV1(Span activeSpan, String productId){
        super(activeSpan);
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
