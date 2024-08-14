package com.product.api.core;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductPriceBracket {
    private Double quantity;
    private Double price;
    
    public ProductPriceBracket(){
        this.price = 0.0;
        this.quantity = -1.0;
    }
    
    public ProductPriceBracket(Double quantity, Double price) {
        this.quantity = quantity;
        this.price = price;
    }

    public Double getPrice() {
        return price;
    }

    public Double getQuantity() {
        return quantity;
    }
}
