// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace Orders.Core.PublicEvents;

public class EventGateway(IPublicEventPublisher publisher) : IEventGateway
{
    public async Task HandleOrderCreated(Order order)
    {
        var v1OrderCreatedEvent = new OrderCreatedEventV1()
        {
            OrderNumber = order.OrderNumber,
            Products = order.Products
        };
        
        await publisher.Publish(v1OrderCreatedEvent);
    }
    
    public async Task HandleOrderConfirmed(Order order)
    {
        var v1OrderConfirmedEvent = new OrderConfirmedEventV1()
        {
            OrderNumber = order.OrderNumber,
        };
        
        await publisher.Publish(v1OrderConfirmedEvent);
    }
    
    public async Task HandleOrderCompleted(Order order)
    {
        var v1OrderCompletedEvent = new OrderCompletedEventV1()
        {
            OrderNumber = order.OrderNumber,
        };
        
        await publisher.Publish(v1OrderCompletedEvent);
    }
}