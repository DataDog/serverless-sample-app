// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.EventBridge.Model;
using Datadog.Trace;
using NJsonSchema;
using Serilog;

namespace Orders.Core.Adapters;

public static class ObservabilityExtensions
{
    public static void AddToTelemetry(this PutEventsRequestEntry publishRequest)
    {
        var schema = JsonSchema.FromSampleJson(publishRequest.Detail);
        var activeSpan = Tracer.Instance.ActiveScope?.Span;

        Log.Information(schema.ToJson());
        Log.Information("Publishing to EventBridge: {EventBusName} - {EventDetailType} with source of {EventSource}", publishRequest.EventBusName, publishRequest.DetailType, publishRequest.Source);
        activeSpan?.SetTag("messaging.message.schema", schema.ToJson());
        activeSpan?.SetTag("messaging.message.source", publishRequest.Source);
        activeSpan?.SetTag("messaging.message.type", publishRequest.DetailType);
        activeSpan?.SetTag("messaging.destination.name", publishRequest.EventBusName);
        activeSpan?.SetTag("messaging.system:aws_eventbridge", "aws_eventbridge");
    }
}