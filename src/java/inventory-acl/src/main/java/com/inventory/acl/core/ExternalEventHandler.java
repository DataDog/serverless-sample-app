/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.acl.core;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.inventory.acl.core.events.external.ProductCreatedEventV1;
import com.inventory.acl.core.events.internal.NewProductAddedEvent;

@Service
public class ExternalEventHandler {
    @Autowired
    EventPublisher publisher;
    
    public void handleProductCreatedV1Event(ProductCreatedEventV1 evt) {
        this.publisher.publishNewProductAddedEvent(new NewProductAddedEvent(evt.getProductId()));
    }
}
