/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.publisher.core.events.external;

import datadog.trace.api.Trace;
import io.opentracing.Span;
import io.opentracing.util.GlobalTracer;

import java.io.Serializable;

public class ProductCreatedEventV1 extends TracedEvent implements Serializable {
    private final String productId;
    
    public ProductCreatedEventV1(Span activeSpan, String productId){
        super(activeSpan);
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
