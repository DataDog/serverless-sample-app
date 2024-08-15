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
