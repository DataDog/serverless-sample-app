package com.inventory.api.driver;

public class ProductDTO {
    private String productId;
    private double currentStockLevel;

    public double getCurrentStockLevel() {
        return currentStockLevel;
    }

    public String getProductId() {
        return productId;
    }

    // Getters and setters
}
