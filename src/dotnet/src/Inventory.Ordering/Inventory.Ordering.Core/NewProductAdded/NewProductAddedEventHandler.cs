// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace Inventory.Ordering.Core.NewProductAdded;

public class NewProductAddedEventHandler(IOrderWorkflowEngine workflowEngine)
{
    public async Task Handle(NewProductAddedEvent evt)
    {
        if (string.IsNullOrEmpty(evt.ProductId))
        {
            throw new Exception("ProductID is null or empty, returning");
        }
        
        await workflowEngine.StartWorkflowFor(evt.ProductId);
    }
}