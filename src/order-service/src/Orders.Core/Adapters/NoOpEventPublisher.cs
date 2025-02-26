// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.Extensions.Logging;
using Orders.Core.InternalEvents;

namespace Orders.Core.Adapters;

public class NoOpEventPublisher(ILogger<NoOpEventPublisher> logger) : IEventPublisher
{
    public Task Publish(OrderCreatedEvent evt)
    {
        logger.LogWarning("Call to NoOp Event Publisher!");
        return Task.CompletedTask;
    }
}