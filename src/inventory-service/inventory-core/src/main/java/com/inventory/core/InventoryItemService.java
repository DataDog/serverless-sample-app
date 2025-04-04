/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

import io.opentracing.Scope;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@ApplicationScoped
public class InventoryItemService {
    private final InventoryItemRepository repository;
    private final OrderCache orderCache;
    private final EventPublisher eventPublisher;
    private final Logger logger = LoggerFactory.getLogger(InventoryItemService.class);

    public InventoryItemService(InventoryItemRepository repository, OrderCache orderCache, EventPublisher eventPublisher) {
        this.repository = repository;
        this.orderCache = orderCache;
        this.eventPublisher = eventPublisher;
    }

    public HandlerResponse<InventoryItemDTO> withProductId(String productId) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            this.logger.info("Received request for product {}", productId);

            span.setTag("product.id", productId);

            InventoryItem existingProduct = this.repository.withProductId(productId);

            if (existingProduct == null) {
                this.logger.warn("Inventory item not found with productID: {}", productId);
                return new HandlerResponse<>(null, List.of("Product not found"), false);
            }

            return new HandlerResponse<>(new InventoryItemDTO(existingProduct), List.of("OK"), true);
        } catch (Error error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));

            return new HandlerResponse<>(null, List.of("Unknown error"), false);
        }
    }

    public HandlerResponse<InventoryItemDTO> updateStock(UpdateInventoryStockRequest request) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            span.setTag("product.id", request.getProductId());

            var validationResponse = request.validate();
            span.setTag("validation.failureCount", validationResponse.size());

            if (!validationResponse.isEmpty()) {
                return new HandlerResponse<>(null, validationResponse, false);
            }

            var existingInventoryItem = this.repository.withProductId(request.getProductId());

            if (existingInventoryItem == null) {
                span.setTag("product.notFound", "true");
                existingInventoryItem = InventoryItem.Create(request.getProductId(), request.getStockLevel());
            }

            var currentStockLevel = existingInventoryItem.getCurrentStockLevel();
            span.setTag("product.currentStockLevel", currentStockLevel);
            span.setTag("product.newStockLevel", request.getStockLevel());
            existingInventoryItem.setCurrentStockLevel(request.getStockLevel());

            this.repository.update(existingInventoryItem);

            this.eventPublisher.publishInventoryStockUpdatedEvent(new InventoryStockUpdatedEvent(existingInventoryItem.getProductId(), currentStockLevel, request.getStockLevel()));

            return new HandlerResponse<>(new InventoryItemDTO(existingInventoryItem), List.of("OK"), true);
        } catch (Error error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));

            return new HandlerResponse<>(null, List.of("Unknown error"), false);
        }
    }

    public HandlerResponse<Boolean> reserveStockForOrder(String orderNumber, List<String> products, String conversationId) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            var isFailure = false;
            ArrayList<InventoryItem> stockAddedFor = new java.util.ArrayList<>();

            span.setTag("order.id", orderNumber);
            span.setTag("order.productCount", products.size());

            for (var productId : products) {
                final Span stockCheckSpan = GlobalTracer.get()
                        .buildSpan("stockCheck")
                        .asChildOf(span)
                        .start();

                try (Scope scope = GlobalTracer.get().activateSpan(stockCheckSpan)) {
                    stockCheckSpan.setTag("product.id", productId);
                    var inventoryItem = this.repository.withProductId(productId);

                    if (inventoryItem.getAvailableStockLevel() <= 0) {
                        stockCheckSpan.setTag("product.outOfStock", "true");
                        isFailure = true;
                        break;
                    }

                    var previousStockLevel = inventoryItem.getCurrentStockLevel();
                    stockCheckSpan.setTag("product.previousStockLevel", previousStockLevel);
                    inventoryItem.reserveStockFor(orderNumber);
                    stockCheckSpan.setTag("product.newStockLevel", inventoryItem.getCurrentStockLevel());

                    this.repository.update(inventoryItem);
                    this.eventPublisher.publishInventoryStockUpdatedEvent(new InventoryStockUpdatedEvent(productId, previousStockLevel, inventoryItem.getCurrentStockLevel()));
                    stockAddedFor.add(inventoryItem);
                }
            }

            orderCache.store(orderNumber, (ArrayList<String>) products);

            if (isFailure) {
                span.setTag("order.reserved", "false");
                this.eventPublisher.publishStockReservationFailedEvent(new StockReservationFailedEventV1(orderNumber, conversationId));
            } else {
                for (InventoryItem inventoryItem : stockAddedFor) {
                    this.repository.update(inventoryItem);
                }
                span.setTag("order.reserved", "true");
                this.eventPublisher.publishStockReservedEvent(new StockReservedEventV1(orderNumber, conversationId));
            }

            return new HandlerResponse<>(true, List.of("OK"), true);
        } catch (Exception e) {
            logger.error("An exception occurred!", e);
            span.setTag(Tags.ERROR, true);
            span.setTag("error.message", e.getMessage());
            return new HandlerResponse<>(false, List.of("Unknown error"), false);
        }
    }

    public HandlerResponse<Boolean> orderDispatched(String orderNumber) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            var products = orderCache.products(orderNumber);
            span.setTag("order.number", orderNumber);

            for (var productId : products) {
                final Span stockCheckSpan = GlobalTracer.get()
                        .buildSpan("dispatchedStock")
                        .asChildOf(span)
                        .start();

                try (Scope scope = GlobalTracer.get().activateSpan(stockCheckSpan)) {
                    stockCheckSpan.setTag("product.id", productId);
                    var inventoryItem = this.repository.withProductId(productId);

                    var previousStockLevel = inventoryItem.getCurrentStockLevel();

                    inventoryItem.stockDispatchedFor(orderNumber);
                    this.repository.update(inventoryItem);
                    this.eventPublisher.publishInventoryStockUpdatedEvent(new InventoryStockUpdatedEvent(inventoryItem.getProductId(), previousStockLevel, inventoryItem.getCurrentStockLevel()));

                    if (inventoryItem.getAvailableStockLevel() <= 0) {
                        stockCheckSpan.setTag("product.outOfStock", "true");
                        this.eventPublisher.publishProductOutOfStockEvent(new ProductOutOfStockEventV1(productId));
                    }
                }
            }

            return new HandlerResponse<>(true, List.of("OK"), true);
        } catch (Exception e) {
            logger.error("An exception occurred!", e);
            span.setTag(Tags.ERROR, true);
            span.setTag("error.message", e.getMessage());
            return new HandlerResponse<>(false, List.of("Unknown error"), false);
        }
    }
}
