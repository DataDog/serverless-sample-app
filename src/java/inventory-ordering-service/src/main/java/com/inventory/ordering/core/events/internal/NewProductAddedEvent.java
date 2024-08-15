package com.inventory.ordering.core.events.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NewProductAddedEvent {
    private String productId;

    public NewProductAddedEvent(){
        this.productId = "";
    }
    
    public NewProductAddedEvent(String productId) {
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
