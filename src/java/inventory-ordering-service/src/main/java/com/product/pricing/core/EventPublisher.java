package com.product.pricing.core;

public interface EventPublisher {
    void publishPriceCalculatedEvent(ProductPriceCalculatedEvent evt);
}
