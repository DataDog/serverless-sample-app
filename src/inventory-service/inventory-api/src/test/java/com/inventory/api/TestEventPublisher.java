/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2025 Datadog, Inc.
 */

package com.inventory.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.core.*;
import com.inventory.core.adapters.EventWrapper;

public class TestEventPublisher implements EventPublisher {
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void publishNewProductAddedEvent(NewProductAddedEvent evt) {
        try {
            var evtWrapper = new EventWrapper<NewProductAddedEvent>(evt);
            String evtData = mapper.writeValueAsString(evtWrapper);

            String lowered = evt.toString();
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void publishInventoryStockUpdatedEvent(InventoryStockUpdatedEvent evt) {
        try {
            var evtWrapper = new EventWrapper<InventoryStockUpdatedEvent>(evt);
            String evtData = mapper.writeValueAsString(evtWrapper);

            String lowered = evt.toString();
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void publishStockReservedEvent(StockReservedEventV1 evt, String conversationId) {
        try {
            var evtWrapper = new EventWrapper<StockReservedEventV1>(evt, conversationId);
            String evtData = mapper.writeValueAsString(evtWrapper);

            String lowered = evt.toString();
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void publishProductOutOfStockEvent(ProductOutOfStockEventV1 evt) {
        try {
            var evtWrapper = new EventWrapper<ProductOutOfStockEventV1>(evt);
            String evtData = mapper.writeValueAsString(evtWrapper);

            String lowered = evt.toString();
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }

    }

    @Override
    public void publishStockReservationFailedEvent(StockReservationFailedEventV1 evt, String conversationId) {
        try {
            var evtWrapper = new EventWrapper<StockReservationFailedEventV1>(evt, conversationId);
            String evtData = mapper.writeValueAsString(evtWrapper);

            String lowered = evt.toString();
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}
