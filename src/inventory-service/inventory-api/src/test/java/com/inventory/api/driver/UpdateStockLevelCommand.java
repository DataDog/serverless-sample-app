package com.inventory.api.driver;

public class UpdateStockLevelCommand {
    private String productId;
    private Double stockLevel;


    public UpdateStockLevelCommand(String productId, Double stockLevel) {
        this.productId = productId;
        this.stockLevel = stockLevel;
    }

    public String getProductId() {
        return productId;
    }

    public Double getStockLevel() {
        return stockLevel;
    }

    // Getters and setters
}
