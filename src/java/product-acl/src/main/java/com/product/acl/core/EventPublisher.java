/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.acl.core;

import com.product.acl.core.events.internal.ProductStockUpdatedEvent;

public interface EventPublisher {
    void publishNewProductAddedEvent(ProductStockUpdatedEvent evt);
}
