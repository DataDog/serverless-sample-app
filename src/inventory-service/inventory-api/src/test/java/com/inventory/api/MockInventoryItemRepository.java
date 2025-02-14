package com.inventory.api;

import com.inventory.api.core.InventoryItem;
import com.inventory.api.core.InventoryItemRepository;

import java.util.HashMap;
import java.util.Map;

public class MockInventoryItemRepository implements InventoryItemRepository {
    private final Map<String, InventoryItem> inventoryItems = new HashMap<>();

    @Override
    public InventoryItem withProductId(String productId) {
        return inventoryItems.get(productId);
    }

    @Override
    public void update(InventoryItem item) {
        inventoryItems.put(item.getProductId(), item);
    }

    // Add methods to manipulate the mock data for testing purposes
    public void addInventoryItem(InventoryItem item) {
        inventoryItems.put(item.getProductId(), item);
    }

    public void clear() {
        inventoryItems.clear();
    }
}
