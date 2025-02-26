// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Orders.BackgroundWorkers.ExternalEvents;
using Orders.Core;
using Orders.Core.InternalEvents;

namespace Orders.BackgroundWorkers;

public class EventGateway(IPublicEventPublisher publisher)
{
    public async Task Handle(OrderCreatedEvent evt)
    {
        var v1OrderCreatedEvent = new OrderCreatedEventV1()
        {
            OrderNumber = evt.OrderNumber
        };
        
        await publisher.Publish(v1OrderCreatedEvent);
    }
}