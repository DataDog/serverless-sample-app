/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.ordering.core;

import com.inventory.ordering.core.events.internal.NewProductAddedEvent;
import org.springframework.stereotype.Service;

@Service
public class InventoryOrderingService {
    private final OrderingWorkflow orderingWorkflow;

    public InventoryOrderingService(OrderingWorkflow orderingWorkflow) {
        this.orderingWorkflow = orderingWorkflow;
    }
    
    public void handleNewProductAdded(NewProductAddedEvent evt) {
        this.orderingWorkflow.startOrderingWorkflowFor(evt.getProductId());
    }
}
