package com.inventory.api.driver;

public class InventoryItemDTO {
    private String productId;
    private Double currentStockLevel;
    private Double reservedStockLevel;

    public String getProductId() {
        return productId;
    }

    public Double getCurrentStockLevel() {
        return currentStockLevel;
    }

    public Double getReservedStockLevel() {
        return reservedStockLevel;
    }
}
