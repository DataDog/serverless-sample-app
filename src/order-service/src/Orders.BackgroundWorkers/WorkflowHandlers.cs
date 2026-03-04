// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using Amazon.Lambda.Annotations;
using Orders.Core.Adapters;
using Orders.Core.StockReservationFailure;
using Orders.Core.StockReservationSuccess;

namespace Orders.BackgroundWorkers;

public class WorkflowHandlers(
    StockReservationSuccessHandler successHandler,
    StockReservationFailureHandler failureHandler,
    ITracingProvider tracingProvider)
{
    [LambdaFunction]
    public async Task ReservationSuccess(StockReservationSuccess request)
    {
        var carrier = JsonSerializer.SerializeToDocument(request);
        var parentContext = tracingProvider.ExtractContextIncludingDsm(
            carrier,
            GetHeader,
            "stepfunctions",
            "orders.confirmOrder");

        using var span = tracingProvider.StartActiveSpan("handle orders.confirmOrder", parentContext);

        request.OrderNumber.AddToTelemetry("order.id");

        await successHandler.Handle(request);
    }

    [LambdaFunction]
    public async Task ReservationFailed(StockReservationFailure request)
    {
        var carrier = JsonSerializer.SerializeToDocument(request);
        var parentContext = tracingProvider.ExtractContextIncludingDsm(
            carrier,
            GetHeader,
            "stepfunctions",
            "orders.noStock");

        using var span = tracingProvider.StartActiveSpan("handle orders.noStock", parentContext);

        request.OrderNumber.AddToTelemetry("order.id");

        await failureHandler.Handle(request);
    }

    private static IEnumerable<string?> GetHeader(JsonDocument doc, string key)
    {
        if (doc.RootElement.TryGetProperty("_datadog", out var datadogProperty))
        {
            if (datadogProperty.TryGetProperty(key, out var value))
            {
                yield return value.GetString();
            }
        }
    }
}