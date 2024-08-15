package com.product.publisher.core.events.external;

import datadog.trace.api.Trace;
import io.opentracing.Span;
import io.opentracing.util.GlobalTracer;

import java.io.Serializable;

public class ProductCreatedEventV1 extends TracedEvent implements Serializable {
    private String productId;
    
    public ProductCreatedEventV1(Span activeSpan, String productId){
        super(activeSpan);
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
