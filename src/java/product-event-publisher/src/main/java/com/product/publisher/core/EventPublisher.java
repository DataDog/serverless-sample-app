/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.publisher.core;

import com.product.publisher.core.events.external.ProductCreatedEventV1;
import com.product.publisher.core.events.external.ProductDeletedEventV1;
import com.product.publisher.core.events.external.ProductUpdatedEventV1;

public interface EventPublisher {
    void publishProductCreatedEvent(ProductCreatedEventV1 evt);
    void publishProductUpdatedEvent(ProductUpdatedEventV1 evt);
    void publishProductDeletedEvent(ProductDeletedEventV1 evt);
}
