/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

import com.inventory.core.adapters.ProductCatalogueItem;
import io.opentracing.Scope;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@ApplicationScoped
public class InventoryItemService {
    private final InventoryItemRepository repository;
    private final OrderCache orderCache;
    private final EventPublisher eventPublisher;
    private final ProductService productService;
    private final Logger logger = LoggerFactory.getLogger(InventoryItemService.class);

    @Inject
    public InventoryItemService(InventoryItemRepository repository, OrderCache orderCache, EventPublisher eventPublisher, ProductService productService) {
        this.repository = repository;
        this.orderCache = orderCache;
        this.eventPublisher = eventPublisher;
        this.productService = productService;
    }

    public HandlerResponse<InventoryItemDTO> withProductId(String productId) {
        final Span span = GlobalTracer.get().activeSpan();

        this.logger.info("Received request for product {}", productId);

        if (span != null) {
            span.setTag("product.id", productId);
        }

        InventoryItem existingProduct = this.repository.withProductId(productId);

        if (existingProduct == null) {
            this.logger.warn("Inventory item not found with productID: {}", productId);
            return new HandlerResponse<>(null, List.of("Product not found"), false);
        }

        return new HandlerResponse<>(new InventoryItemDTO(existingProduct), List.of("OK"), true);
    }

    public HandlerResponse<InventoryItemDTO> updateStock(UpdateInventoryStockRequest request) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            if (span != null) {
                span.setTag("product.id", request.getProductId());
            }

            var validationResponse = request.validate();
            if (span != null) {
                span.setTag("validation.failureCount", validationResponse.size());
            }

            if (!validationResponse.isEmpty()) {
                return new HandlerResponse<>(null, validationResponse, false);
            }

            InventoryItem existingInventoryItem;

            try {
                existingInventoryItem = this.repository.withProductId(request.getProductId());
            } catch (InventoryItemNotFoundException ex) {
                if (span != null) {
                    span.setTag("product.notFound", "true");
                }
                existingInventoryItem = InventoryItem.Create(request.getProductId(), request.getStockLevel());
            }

            var currentStockLevel = existingInventoryItem.getCurrentStockLevel();
            if (span != null) {
                span.setTag("product.currentStockLevel", currentStockLevel);
                span.setTag("product.newStockLevel", request.getStockLevel());
            }
            existingInventoryItem.setCurrentStockLevel(request.getStockLevel());

            this.repository.update(existingInventoryItem);

            this.eventPublisher.publishInventoryStockUpdatedEvent(
                    new InventoryStockUpdatedEvent(existingInventoryItem.getProductId(), 
                            currentStockLevel, request.getStockLevel()));

            return new HandlerResponse<>(new InventoryItemDTO(existingInventoryItem), List.of("OK"), true);
        } catch (Exception e) {
            logger.error("Error updating stock", e);
            if (span != null) {
                span.setTag(Tags.ERROR, true);
                span.log(Collections.singletonMap(Fields.ERROR_OBJECT, e));
            }
            return new HandlerResponse<>(null, List.of("Unknown error: " + e.getMessage()), false);
        }
    }

    public HandlerResponse<Boolean> reserveStockForOrder(String orderNumber, List<String> products, String conversationId) {
        final Span span = GlobalTracer.get().activeSpan();
        logger.info("Reserving stock for order {} with {} products", orderNumber, products.size());

        if (span != null) {
            span.setTag("order.id", orderNumber);
            span.setTag("order.productCount", products.size());
            span.setTag("order.conversationId", conversationId);
        }

        try {
            orderCache.store(orderNumber, new ArrayList<>(products));
        } catch (Exception e) {
            logger.error("Failed to store order in cache", e);
            if (span != null) {
                span.setTag("error.orderCache", true);
                span.setTag("error.message", e.getMessage());
            }
            // Continue despite cache failure - we'll try to process the order anyway
        }

        try {
            InventoryItemReservationResult result = reserveStockForInventoryItems(orderNumber, products, span);

            // Publish appropriate events based on reservation result
            if (result.isFailure().get()) {
                if (span != null) {
                    span.setTag("order.reserved", "false");
                }

                logger.warn("Stock reservation failed for order {}", orderNumber);

                this.eventPublisher.publishStockReservationFailedEvent(
                        new StockReservationFailedEventV1(orderNumber, conversationId));
            } else {
                if (span != null) {
                    span.setTag("order.reserved", "true");
                }

                logger.info("Successfully reserved stock for order {}", orderNumber);

                // Update all reserved items
                for (InventoryItem inventoryItem : result.stockAddedFor()) {
                    this.repository.update(inventoryItem);
                }
                this.eventPublisher.publishStockReservedEvent(
                        new StockReservedEventV1(orderNumber, conversationId));
            }

            return new HandlerResponse<>(true, List.of("OK"), true);
        } catch (Exception e) {
            logger.error("Error reserving stock", e);
            if (span != null) {
                span.setTag(Tags.ERROR, true);
                span.setTag("error.message", e.getMessage());
            }
            
            // Attempt to publish failure event despite error
            try {
                this.eventPublisher.publishStockReservationFailedEvent(
                        new StockReservationFailedEventV1(orderNumber, conversationId));
            } catch (Exception publishError) {
                logger.error("Failed to publish reservation failure event", publishError);
            }
            
            return new HandlerResponse<>(false, List.of("Error reserving stock: " + e.getMessage()), false);
        }
    }

    public HandlerResponse<Boolean> refreshProductCache() {
        final Span span = GlobalTracer.get().activeSpan();
        logger.info("Checking all products exist from product cache");

        var products = this.productService.getProductCatalogue();

        if (span != null) {
            span.setTag("product.count", products.size());
        }

        if (products == null || products.isEmpty()) {
            logger.warn("No products returned from product service");
            return new HandlerResponse<>(false, List.of("No products found"), false);
        }

        for (ProductCatalogueItem product : products) {
            try {
                logger.info("Checking product {}", product.getProductId());
                var existingProduct = this.repository.withProductId(product.getProductId());
                logger.info("Found existing product with id %s", existingProduct.getProductId());
            }
            catch (InventoryItemNotFoundException e) {
                logger.info("Didn't find existing product with id", product.getProductId());
                this.eventPublisher.publishNewProductAddedEvent(new NewProductAddedEvent(product.getProductId()));
            }
        }

        return new HandlerResponse<>(true, List.of("Success"), false);
    }

    private InventoryItemReservationResult reserveStockForInventoryItems(String orderNumber, List<String> products, Span span) {
        AtomicBoolean isFailure = new AtomicBoolean(false);
        List<InventoryItem> stockAddedFor = Collections.synchronizedList(new ArrayList<>());

        logger.info("Using parallel processing for large order with {} products", products.size());

        List<CompletableFuture<Void>> futures = products.stream()
                .map(productId -> CompletableFuture.runAsync(() -> {
                    if (isFailure.get()) {
                        return; // Skip if we already know we'll fail
                    }

                    processProductReservation(productId, orderNumber, stockAddedFor, isFailure, span);
                }))
                .collect(Collectors.toList());

        try {
            // Wait for all product reservations to complete with timeout
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                    .get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            logger.error("Error in parallel product reservation", e);
            isFailure.set(true);
        }
        InventoryItemReservationResult result = new InventoryItemReservationResult(isFailure, stockAddedFor);
        return result;
    }

    private record InventoryItemReservationResult(AtomicBoolean isFailure, List<InventoryItem> stockAddedFor) {
    }

    private void processProductReservation(String productId, String orderNumber, 
                                         List<InventoryItem> stockAddedFor, 
                                         AtomicBoolean isFailure, Span parentSpan) {
        final Span stockCheckSpan = GlobalTracer.get()
                .buildSpan("stockCheck")
                .asChildOf(parentSpan)
                .start();
                
        try (Scope scope = GlobalTracer.get().activateSpan(stockCheckSpan)) {
            stockCheckSpan.setTag("product.id", productId);
            
            var inventoryItem = this.repository.withProductId(productId);
            if (inventoryItem == null) {
                stockCheckSpan.setTag("product.notFound", "true");
                isFailure.set(true);
                logger.warn("Product not found for reservation: {}", productId);
                return;
            }

            if (inventoryItem.getAvailableStockLevel() <= 0) {
                stockCheckSpan.setTag("product.outOfStock", "true");
                isFailure.set(true);
                logger.warn("Product out of stock: {} (available: {})", 
                    productId, inventoryItem.getAvailableStockLevel());
                return;
            }

            var previousStockLevel = inventoryItem.getCurrentStockLevel();
            stockCheckSpan.setTag("product.previousStockLevel", previousStockLevel);
            
            inventoryItem.reserveStockFor(orderNumber);
            stockCheckSpan.setTag("product.newStockLevel", inventoryItem.getCurrentStockLevel());

            stockAddedFor.add(inventoryItem);
            logger.info("Reserved stock for product {} in order {}", productId, orderNumber);
        } catch (Exception e) {
            logger.error("Error processing product reservation", e);
            stockCheckSpan.setTag(Tags.ERROR, true);
            stockCheckSpan.setTag("error.message", e.getMessage());
            isFailure.set(true);
        } finally {
            stockCheckSpan.finish();
        }
    }

    public HandlerResponse<Boolean> orderDispatched(String orderNumber) {
        final Span span = GlobalTracer.get().activeSpan();
        logger.info("Processing dispatched order: {}", orderNumber);

        if (span != null) {
            span.setTag("order.number", orderNumber);
        }

        try {
            var products = orderCache.products(orderNumber);
            if (products == null || products.isEmpty()) {
                logger.warn("No products found for order: {}", orderNumber);
                return new HandlerResponse<>(false, List.of("No products found for this order"), false);
            }

            // Process each product to mark as dispatched
            for (var productId : products) {
                final Span stockCheckSpan = GlobalTracer.get()
                        .buildSpan("dispatchedStock")
                        .asChildOf(span)
                        .start();

                try (Scope scope = GlobalTracer.get().activateSpan(stockCheckSpan)) {
                    stockCheckSpan.setTag("product.id", productId);
                    var inventoryItem = this.repository.withProductId(productId);

                    if (inventoryItem == null) {
                        stockCheckSpan.setTag("product.notFound", "true");
                        logger.warn("Product not found for dispatch: {}", productId);
                        continue;
                    }

                    var previousStockLevel = inventoryItem.getCurrentStockLevel();
                    stockCheckSpan.setTag("product.previousStockLevel", previousStockLevel);

                    inventoryItem.stockDispatchedFor(orderNumber);
                    this.repository.update(inventoryItem);
                    
                    this.eventPublisher.publishInventoryStockUpdatedEvent(
                            new InventoryStockUpdatedEvent(inventoryItem.getProductId(), 
                                    previousStockLevel, inventoryItem.getCurrentStockLevel()));

                    if (inventoryItem.getAvailableStockLevel() <= 0) {
                        stockCheckSpan.setTag("product.outOfStock", "true");
                        logger.warn("Product out of stock after dispatch: {}", productId);
                        this.eventPublisher.publishProductOutOfStockEvent(
                                new ProductOutOfStockEventV1(productId));
                    }
                    
                    logger.info("Product dispatched: {}", productId);
                } catch (Exception e) {
                    logger.error("Error processing product dispatch", e);
                    stockCheckSpan.setTag(Tags.ERROR, true);
                    stockCheckSpan.setTag("error.message", e.getMessage());
                } finally {
                    stockCheckSpan.finish();
                }
            }

            logger.info("Order dispatch completed: {}", orderNumber);
            return new HandlerResponse<>(true, List.of("OK"), true);
        } catch (Exception e) {
            logger.error("Error dispatching order", e);
            if (span != null) {
                span.setTag(Tags.ERROR, true);
                span.setTag("error.message", e.getMessage());
            }
            return new HandlerResponse<>(false, List.of("Error dispatching order: " + e.getMessage()), false);
        }
    }
}
