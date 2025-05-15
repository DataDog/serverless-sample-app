package com.inventory.core;

public class InventoryItemNotFoundException extends RuntimeException {
    private final String inventoryItemId;
    public InventoryItemNotFoundException(String inventoryItemId) {
        super("Inventory item not found: " + inventoryItemId);
        this.inventoryItemId = inventoryItemId;
    }

    public String getInventoryItemId() {
        return this.inventoryItemId;
    }
}
