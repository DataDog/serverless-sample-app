package com.product.publisher.core;

import com.product.publisher.core.events.external.ProductDeletedEventV1;
import com.product.publisher.core.events.internal.ProductCreatedEvent;
import com.product.publisher.core.events.internal.ProductUpdatedEvent;

public interface EventPublisher {
    void handleProductCreatedEvent(ProductCreatedEvent evt);
    void handleProductUpdatedEvent(ProductUpdatedEvent eventV1);
    void handleProductDeletedEvent(ProductDeletedEventV1 eventV1);
}
