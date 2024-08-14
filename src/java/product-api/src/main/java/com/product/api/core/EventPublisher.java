package com.product.api.core;

public interface EventPublisher {
    boolean publishProductCreatedEvent(ProductCreatedEvent evt);
    boolean publishProductUpdatedEvent(ProductUpdatedEvent evt);
    boolean publishProductDeletedEvent(ProductDeletedEvent evt);
}
