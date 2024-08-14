package com.product.pricing.core;

import java.util.HashMap;

public class ProductPriceCalculatedEvent {
    private final String productId;
    private final HashMap<Double, Double> priceBrackets;

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
