package com.product.api.core;

public class ProductPriceBracket {
    private final Double quantity;
    private final Double price;

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
