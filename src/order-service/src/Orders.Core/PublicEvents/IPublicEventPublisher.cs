// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Core.PublicEvents;

public interface IPublicEventPublisher
{
    Task Publish(OrderCreatedEventV1 evt);
    
    Task Publish(OrderConfirmedEventV1 evt);
    
    Task Publish(OrderCompletedEventV1 evt);
}