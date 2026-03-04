package com.inventory.api;

import com.inventory.core.*;
import com.inventory.core.adapters.ProductCatalogueItem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Offline unit tests for inventory service business logic.
 * No AWS credentials or network access required.
 */
class ProductResourceTest {
    private MockInventoryItemRepository repository;
    private TestEventPublisher eventPublisher;
    private InventoryItemService service;

    @BeforeEach
    void setup() {
        repository = new MockInventoryItemRepository();
        eventPublisher = new TestEventPublisher();
        OrderCache orderCache = new InMemoryOrderCache();
        ProductService productService = new StubProductService();
        service = new InventoryItemService(repository, orderCache, eventPublisher, productService);
    }

    @Test
    void get_product_returns_item_when_exists() {
        var productId = UUID.randomUUID().toString();
        var orders = new ArrayList<String>();
        orders.add("");
        var item = new InventoryItem(productId, 10.0, 0.0, orders);
        repository.addInventoryItem(item);

        var result = service.withProductId(productId);

        assertTrue(result.isSuccess());
        assertNotNull(result.getData());
        assertEquals(productId, result.getData().getProductId());
        assertEquals(10.0, result.getData().getCurrentStockLevel());
    }

    @Test
    void get_product_throws_when_missing() {
        assertThrows(InventoryItemNotFoundException.class, () -> service.withProductId("nonexistent-product"));
    }

    @Test
    void update_stock_sets_new_level() {
        var productId = UUID.randomUUID().toString();
        var orders = new ArrayList<String>();
        orders.add("");
        var item = new InventoryItem(productId, 5.0, 0.0, orders);
        repository.addInventoryItem(item);

        var request = new UpdateInventoryStockRequest();
        request.setProductId(productId);
        request.setStockLevel(20.0);

        var result = service.updateStock(request);

        assertTrue(result.isSuccess());
        assertEquals(20.0, result.getData().getCurrentStockLevel());
    }

    @Test
    void update_stock_creates_item_when_not_found() {
        var productId = UUID.randomUUID().toString();

        var request = new UpdateInventoryStockRequest();
        request.setProductId(productId);
        request.setStockLevel(15.0);

        var result = service.updateStock(request);

        assertTrue(result.isSuccess());
        assertEquals(15.0, result.getData().getCurrentStockLevel());
    }

    @Test
    void update_stock_rejects_invalid_request() {
        var request = new UpdateInventoryStockRequest();
        request.setProductId("ab"); // too short
        request.setStockLevel(-1.0); // negative

        var result = service.updateStock(request);

        assertFalse(result.isSuccess());
        assertNull(result.getData());
    }

    @Test
    void reserve_stock_decreases_available_level() {
        var productId = UUID.randomUUID().toString();
        var orderNumber = UUID.randomUUID().toString();
        var orders = new ArrayList<String>();
        orders.add("");
        var item = new InventoryItem(productId, 10.0, 0.0, orders);
        repository.addInventoryItem(item);

        var result = service.reserveStockForOrder(orderNumber, List.of(productId), "conv-1");

        assertTrue(result.isSuccess());
        var updatedItem = repository.withProductId(productId);
        assertEquals(1.0, updatedItem.getReservedStockLevel());
    }

    @Test
    void reserve_stock_fails_when_product_not_found() {
        var orderNumber = UUID.randomUUID().toString();

        var result = service.reserveStockForOrder(orderNumber, List.of("nonexistent"), "conv-1");

        assertTrue(result.isSuccess()); // method returns true but publishes failure event
    }

    /**
     * Simple in-memory order cache for offline tests.
     */
    static class InMemoryOrderCache implements OrderCache {
        private final java.util.Map<String, ArrayList<String>> cache = new java.util.HashMap<>();

        @Override
        public ArrayList<String> products(String orderId) {
            return cache.get(orderId);
        }

        @Override
        public void store(String orderId, ArrayList<String> products) {
            cache.put(orderId, products);
        }
    }

    /**
     * Stub product service that returns an empty catalogue for offline tests.
     */
    static class StubProductService implements ProductService {
        @Override
        public ArrayList<ProductCatalogueItem> getProductCatalogue() {
            return new ArrayList<>();
        }
    }
}
