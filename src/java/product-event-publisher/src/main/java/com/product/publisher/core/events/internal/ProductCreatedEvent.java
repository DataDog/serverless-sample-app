package com.product.publisher.core.events.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductCreatedEvent {
    private String productId;
    private String name;
    private Double price;

    public ProductCreatedEvent(){
        this.productId = ""; this.name = ""; this.price = -1.0;
    }
    
    public ProductCreatedEvent(String productId, String name, Double price) {
        this.productId = productId; this.name = name;
        this.price = price;
    }

    public String getProductId() {
        return productId;
    }

    public String getName() {
        return name;
    }

    public Double getPrice() {
        return price;
    }
}
