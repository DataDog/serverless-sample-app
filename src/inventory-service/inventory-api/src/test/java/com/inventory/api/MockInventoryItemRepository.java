package com.inventory.api;

import com.inventory.core.DataAccessException;
import com.inventory.core.InventoryItem;
import com.inventory.core.InventoryItemNotFoundException;
import com.inventory.core.InventoryItemRepository;
import com.inventory.core.StaleItemException;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class MockInventoryItemRepository implements InventoryItemRepository {
    private final Map<String, InventoryItem> inventoryItems = new HashMap<>();
    private final Set<String> failUpdateForProducts = new HashSet<>();

    @Override
    public InventoryItem withProductId(String productId) throws DataAccessException, InventoryItemNotFoundException {
        InventoryItem item = inventoryItems.get(productId);
        if (item == null) {
            throw new InventoryItemNotFoundException(productId);
        }
        return item;
    }

    @Override
    public void update(InventoryItem item) {
        if (failUpdateForProducts.contains(item.getProductId())) {
            throw new StaleItemException(item.getProductId());
        }
        inventoryItems.put(item.getProductId(), item);
    }

    public void failUpdateForProduct(String productId) {
        failUpdateForProducts.add(productId);
    }

    // Add methods to manipulate the mock data for testing purposes
    public void addInventoryItem(InventoryItem item) {
        inventoryItems.put(item.getProductId(), item);
    }

    public void clear() {
        inventoryItems.clear();
    }
}
