/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2025 Datadog, Inc.
 */

package com.inventory.api.container;

import com.inventory.api.container.core.EventPublisher;
import com.inventory.api.container.core.InventoryStockUpdatedEvent;

public class TestEventPublisher implements EventPublisher {
    @Override
    public void publishInventoryStockUpdatedEvent(InventoryStockUpdatedEvent evt) {

    }
}
