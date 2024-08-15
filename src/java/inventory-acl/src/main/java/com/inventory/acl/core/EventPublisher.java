package com.inventory.acl.core;

import com.inventory.acl.core.events.internal.NewProductAddedEvent;

public interface EventPublisher {
    void publishNewProductAddedEvent(NewProductAddedEvent evt);
}
