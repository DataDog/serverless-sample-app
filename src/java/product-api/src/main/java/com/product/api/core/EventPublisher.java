/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.core;

public interface EventPublisher {
    void publishProductCreatedEvent(ProductCreatedEvent evt);
    void publishProductUpdatedEvent(ProductUpdatedEvent evt);
    void publishProductDeletedEvent(ProductDeletedEvent evt);
}
