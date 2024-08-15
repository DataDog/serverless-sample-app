package com.product.publisher.core;

import com.product.publisher.core.events.external.ProductCreatedEventV1;
import com.product.publisher.core.events.external.ProductDeletedEventV1;
import com.product.publisher.core.events.external.ProductUpdatedEventV1;

public interface EventPublisher {
    void publishProductCreatedEvent(ProductCreatedEventV1 evt);
    void publishProductUpdatedEvent(ProductUpdatedEventV1 evt);
    void publishProductDeletedEvent(ProductDeletedEventV1 evt);
}
