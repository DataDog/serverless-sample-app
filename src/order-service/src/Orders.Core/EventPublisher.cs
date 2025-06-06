// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Core.PublicEvents;

namespace Orders.Core;

public interface IEventGateway
{
    Task HandleOrderCreated(Order order);
    Task HandleOrderConfirmed(Order order);
    Task HandleOrderCompleted(Order order);
}