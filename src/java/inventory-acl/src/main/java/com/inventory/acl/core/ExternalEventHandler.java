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
