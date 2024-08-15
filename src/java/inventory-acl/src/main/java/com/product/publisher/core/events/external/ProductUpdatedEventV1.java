package com.product.publisher.core.events.external;

public class ProductUpdatedEventV1 {
    private String productId;
    
    public ProductUpdatedEventV1(String productId){
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
