// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Datadog.Trace;
using Orders.Core.Adapters;

namespace Orders.Core.StockReservationFailure;

public class StockReservationFailureHandler(IOrders orders)
{
    public async Task Handle(StockReservationFailure request)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;

        using var processingSpan = Tracer.Instance.StartActive($"handle StockReservationSuccess",
            new SpanCreationSettings
            {
                Parent = activeSpan?.Context
            });
        request.OrderNumber.AddToTelemetry("order.id");
        request.UserId.AddToTelemetry("user.id");
        
        var order = await orders.WithOrderId(request.UserId, request.OrderNumber);

        if (order == null) return;

        order.ReservationFailed();

        await orders.Store(order);
    }
}