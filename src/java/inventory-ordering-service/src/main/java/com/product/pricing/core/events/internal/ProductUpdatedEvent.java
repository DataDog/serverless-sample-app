package com.product.pricing.core.events.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductUpdatedEvent {
    private String productId;
    private ProductDetails previous;
    private ProductDetails updated;

    public ProductUpdatedEvent(){
        this.productId = "";
        this.previous = new ProductDetails();
        this.updated = new ProductDetails(); 
    }

    public ProductUpdatedEvent(String productId, ProductDetails previousDetails, ProductDetails newDetails) {
        this.productId = productId;
        this.previous = previousDetails;
        this.updated = newDetails;
    }

    public String getProductId() {
        return productId;
    }

    public ProductDetails getPrevious() {
        return previous;
    }

    public ProductDetails getUpdated() {
        return updated;
    }
}
