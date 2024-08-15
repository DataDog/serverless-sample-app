package com.product.publisher.core;

import com.product.publisher.core.events.external.ProductCreatedEventV1;
import com.product.publisher.core.events.external.ProductDeletedEventV1;
import com.product.publisher.core.events.external.ProductUpdatedEventV1;
import com.product.publisher.core.events.internal.ProductCreatedEvent;
import com.product.publisher.core.events.internal.ProductDeletedEvent;
import com.product.publisher.core.events.internal.ProductUpdatedEvent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class InternalEventHandler {
    @Autowired
    EventPublisher publisher;
    
    public void handleProductCreatedEvent(ProductCreatedEvent evt) {
        this.publisher.publishProductCreatedEvent(new ProductCreatedEventV1(evt.getProductId()));
    }

    public void handleProductUpdatedEvent(ProductUpdatedEvent evt){
        this.publisher.publishProductUpdatedEvent(new ProductUpdatedEventV1(evt.getProductId()));
    }

    public void handleProductDeletedEvent(ProductDeletedEvent evt){
        this.publisher.publishProductDeletedEvent(new ProductDeletedEventV1(evt.getProductId()));
    }
}
