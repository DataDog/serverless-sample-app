package com.product.api.core.events.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.HashMap;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductPriceCalculatedEvent {
    private String productId;
    private HashMap<Double, Double> priceBrackets;

    public ProductPriceCalculatedEvent(){
        this.productId = "";
        this.priceBrackets = new HashMap<>();
    }

    public ProductPriceCalculatedEvent(String productId, HashMap<Double, Double> priceBrackets) {
        this.productId = productId;
        this.priceBrackets = priceBrackets;
    }

    public HashMap<Double, Double> getPriceBrackets() {
        return priceBrackets;
    }

    public String getProductId() {
        return productId;
    }
}

