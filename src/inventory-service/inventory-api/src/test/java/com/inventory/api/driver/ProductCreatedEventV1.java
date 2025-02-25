package com.inventory.api.driver;

public class ProductCreatedEventV1 {
    private String productId;

    public ProductCreatedEventV1(){}

    public ProductCreatedEventV1(String productId){
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }
}
