package com.product.publisher.core.events.external;

import io.opentracing.Span;

import java.io.Serializable;

public class ProductUpdatedEventV1 extends TracedEvent implements Serializable {
    private String productId;
    
    public ProductUpdatedEventV1(Span activeSpan, String productId){
        super(activeSpan);
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
