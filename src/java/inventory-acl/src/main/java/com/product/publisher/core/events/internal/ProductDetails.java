package com.product.publisher.core.events.internal;

public class ProductDetails {
    private final String name;
    private final Double price;
    
    public ProductDetails(){
        this.name = "";
        this.price = -1.0;
    }

    public ProductDetails(String name, Double price) {
        this.name = name;
        this.price = price;
    }

    public String getName() {
        return name;
    }

    public Double getPrice() {
        return price;
    }
}
