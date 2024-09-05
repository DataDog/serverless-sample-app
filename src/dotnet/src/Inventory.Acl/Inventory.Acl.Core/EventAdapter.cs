// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Inventory.Acl.Core.ExternalEvents;
using Inventory.Acl.Core.InternalEvents;

namespace Inventory.Acl.Core;

public class EventAdapter(IInternalEventPublisher publisher)
{
    public async Task Handle(ProductCreatedEventV1 evt)
    {
        await publisher.Publish(new NewProductAddedEvent()
        {
            ProductId = evt.ProductId
        });
    }
    
    public async Task Handle(ProductUpdatedEventV1 evt)
    {
        await publisher.Publish(new NewProductAddedEvent()
        {
            ProductId = evt.ProductId
        });
    }
}