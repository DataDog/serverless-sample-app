package com.product.publisher.core.events.external;

import io.opentracing.Span;

import java.io.Serializable;

public class ProductDeletedEventV1 extends TracedEvent implements Serializable {
    private String productId;
    
    public ProductDeletedEventV1(Span activeSpan, String productId){
        super(activeSpan);
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
