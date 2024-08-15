package com.product.publisher.core.events.external;

public class ProductDeletedEventV1 {
    private String productId;
    
    public ProductDeletedEventV1(String productId){
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
