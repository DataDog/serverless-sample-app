// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Product.Acl.Core.ExternalEvents;
using Product.Acl.Core.InternalEvents;

namespace Product.Acl.Core;

public class EventAdapter(IInternalEventPublisher publisher)
{
    public async Task Handle(InventoryStockUpdated evt)
    {
        await publisher.Publish(new ProductStockUpdated()
        {
            ProductId = evt.ProductId,
            StockLevel = evt.NewStockLevel
        });
    }
}