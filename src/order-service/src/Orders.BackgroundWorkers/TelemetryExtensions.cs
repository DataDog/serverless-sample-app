// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text;
using System.Text.Json;
using Amazon.Lambda.SQSEvents;
using Amazon.SimpleNotificationService.Model;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;
using NJsonSchema;
using Orders.BackgroundWorkers.ExternalEvents;
using StatsdClient;

namespace Orders.BackgroundWorkers;

public static class TelemetryExtensions
{
    public static void AddToTelemetry(this SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        activeSpan?.SetTag("messaging.operation.type", "receive");
        activeSpan?.SetTag("messaging.system", "aws_sqs");
        activeSpan?.SetTag("messaging.batch.message_count", evt.Records.Count);
    }
    
    public static void AddToTelemetry<T>(this EventWrapper<T> evt)
    {
        var span = Tracer.Instance.ActiveScope?.Span;
        if (span == null)
        {
            return;
        }
        
        span.SetTag("domain", Environment.GetEnvironmentVariable("DOMAIN"));
        span.SetTag("messaging.message.eventType", "public");
        span.SetTag("messaging.message.type", evt.Type);
        span.SetTag("messaging.message.domain", Environment.GetEnvironmentVariable("DOMAIN"));
        span.SetTag("messaging.message.id", evt.Id);
        span.SetTag("messaging.operation.type", "process");
        span.SetTag("messaging.system", "eventbridge");
        span.SetTag("messaging.batch.message_count", 1);
        span.SetTag("messaging.client.id", Environment.GetEnvironmentVariable("DD_SERVICE") ?? "");
        span.SetTag("messaging.message.envelope.size", Encoding.UTF8.GetBytes(JsonSerializer.Serialize(evt)).Length);
        span.SetTag("messaging.message.body.size", Encoding.UTF8.GetBytes(JsonSerializer.Serialize(evt.Data)).Length);
        span.SetTag("messaging.operation.name", "process");
    }
    
    public static void AddToTelemetry(this SQSEvent.SQSMessage record)
    {
        var schema = JsonSchema.FromSampleJson(record.Body);
        Logger.LogInformation(schema.ToJson());
        
        var processingSpan = Tracer.Instance.ActiveScope?.Span;
        processingSpan?.SetTag("messaging.message.body.size",
            Encoding.UTF8.GetByteCount(record.Body));
        processingSpan?.SetTag("messaging.message.schema", schema.ToJson());
    }
}