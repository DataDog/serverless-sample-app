// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Datadog.Trace;
using Orders.Api.CompleteOrder;
using Orders.Api.CreateOrder;

namespace Orders.Api;

public static class TraceExtensions
{
    public static void AddToTelemetry(this CompleteOrderRequest request)
    {
        if (Tracer.Instance.ActiveScope == null)
        {
            return;
        }
        
        Tracer.Instance.ActiveScope.Span.SetTag("order.id", request.OrderId);
        Tracer.Instance.ActiveScope.Span.SetTag("user.id", request.UserId);
    }
    public static void AddToTelemetry(this CreateOrderRequest request)
    {
        if (Tracer.Instance.ActiveScope == null)
        {
            return;
        }
        
        Tracer.Instance.ActiveScope.Span.SetTag("order.productCount", request.Products.Length);
    }
}