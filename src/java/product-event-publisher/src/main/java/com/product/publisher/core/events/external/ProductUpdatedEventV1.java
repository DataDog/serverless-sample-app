package com.product.publisher.core.events.external;

public class ProductCreatedEventV1 {
    private String productId;
    
    public ProductCreatedEventV1(String productId){
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
