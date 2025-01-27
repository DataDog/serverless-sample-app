/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.api.container.core;

import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.List;

@ApplicationScoped
public class InventoryItemService {
    private final InventoryItemRepository repository;
    private final EventPublisher eventPublisher;
    private final Logger logger = LoggerFactory.getLogger(InventoryItemService.class);

    public InventoryItemService(InventoryItemRepository repository, EventPublisher eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }

    public HandlerResponse<InventoryItemDTO> withProductId(String productId) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            this.logger.info(String.format("Received request for product %s", productId));

            span.setTag("product.id", productId);

            InventoryItem existingProduct = this.repository.withProductId(productId);

            if (existingProduct == null) {
                this.logger.warn("Inventory item not found with productID: " + productId);
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

            if (!validationResponse.isEmpty()) {
                return new HandlerResponse<>(null, validationResponse, false);
            }

            var existingInventoryItem = this.repository.withProductId(request.getProductId());

            if (existingInventoryItem == null) {
                return new HandlerResponse<>(null, List.of("Product not found"), false);
            }

            var currentStockLevel = existingInventoryItem.getCurrentStockLevel();
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
}
