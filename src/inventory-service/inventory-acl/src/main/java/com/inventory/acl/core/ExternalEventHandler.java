/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.acl.core;

import com.inventory.acl.core.events.external.OrderCompletedEventV1;
import com.inventory.acl.core.events.external.OrderCreatedEventV1;
import com.inventory.core.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import com.inventory.acl.core.events.external.ProductCreatedEventV1;

@ApplicationScoped
public class ExternalEventHandler {
    @Inject
    EventPublisher eventPublisher;

    @Inject
    InventoryItemService itemService;
    
    public void handleProductCreatedV1Event(ProductCreatedEventV1 evt) {
        this.eventPublisher.publishNewProductAddedEvent(new NewProductAddedEvent(evt.getProductId()));
    }

    public boolean handleOrderCreatedV1Event(OrderCreatedEventV1 evt, String conversationId) {
        return (this.itemService.reserveStockForOrder(evt.getOrderNumber(), evt.getProducts(), conversationId)).isSuccess();
    }

    public boolean handleOrderCompletedV1Event(OrderCompletedEventV1 evt) {
        return (this.itemService.orderDispatched(evt.getOrderNumber())).isSuccess();
    }
}
