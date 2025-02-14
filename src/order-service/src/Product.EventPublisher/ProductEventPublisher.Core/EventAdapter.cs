// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using ProductEventPublisher.Core.ExternalEvents;
using ProductEventPublisher.Core.InternalEvents;

namespace ProductEventPublisher.Core;

public class EventAdapter(IExternalEventPublisher externalEventPublisher)
{
    public async Task HandleInternalEvent(ProductCreatedEvent evt)
    {
        await externalEventPublisher.Publish(new ProductCreatedEventV1()
        {
            ProductId = evt.ProductId
        });
    }
    public async Task HandleInternalEvent(ProductUpdatedEvent evt)
    {
        await externalEventPublisher.Publish(new ProductUpdatedEventV1()
        {
            ProductId = evt.ProductId
        });
    }
    public async Task HandleInternalEvent(ProductDeletedEvent evt)
    {
        await externalEventPublisher.Publish(new ProductDeletedEventV1()
        {
            ProductId = evt.ProductId
        });
    }
}