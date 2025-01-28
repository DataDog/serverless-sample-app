/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.acl.core;

import com.product.acl.core.events.external.InventoryStockUpdatedEventV1;
import com.product.acl.core.events.internal.ProductStockUpdatedEvent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ExternalEventHandler {
    @Autowired
    EventPublisher publisher;
    
    public void handleInventoryStockUpdatedEvent(InventoryStockUpdatedEventV1 evt) {
        this.publisher.publishNewProductAddedEvent(new ProductStockUpdatedEvent(evt.getProductId(), evt.getNewStockLevel()));
    }
}
