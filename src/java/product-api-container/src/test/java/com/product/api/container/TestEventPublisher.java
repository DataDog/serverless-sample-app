/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2025 Datadog, Inc.
 */

package com.product.api.container;

import com.product.api.container.core.EventPublisher;
import com.product.api.container.core.ProductCreatedEvent;
import com.product.api.container.core.ProductDeletedEvent;
import com.product.api.container.core.ProductUpdatedEvent;

public class TestEventPublisher implements EventPublisher {
    @Override
    public void publishProductCreatedEvent(ProductCreatedEvent evt) {
    }

    @Override
    public void publishProductUpdatedEvent(ProductUpdatedEvent evt) {

    }

    @Override
    public void publishProductDeletedEvent(ProductDeletedEvent evt) {

    }
}
