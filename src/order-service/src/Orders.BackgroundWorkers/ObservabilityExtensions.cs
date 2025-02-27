// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text;
using Amazon.Lambda.SQSEvents;
using Amazon.SimpleNotificationService.Model;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;
using NJsonSchema;
using StatsdClient;

namespace Orders.BackgroundWorkers;

public static class ObservabilityExtensions
{
    public static void AddToTelemetry(this SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        activeSpan?.SetTag("messaging.operation.type", "receive");
        activeSpan?.SetTag("messaging.system", "aws_sqs");
        activeSpan?.SetTag("messaging.batch.message_count", evt.Records.Count);
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
    
    public static void AddToTelemetry(this PublishRequest publishRequest)
    {
        var destinationName = ExtractNameFromArn(publishRequest.TopicArn);
        
        var schema = JsonSchema.FromSampleJson(publishRequest.Message);
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        Logger.LogInformation(schema.ToJson());
        activeSpan?.SetTag("messaging.message.schema", schema.ToJson());
        activeSpan?.SetTag("messaging.message.type", destinationName);
        activeSpan?.SetTag("messaging.destination.name", destinationName);
        
        DogStatsd.Increment("messaging.client.published.messages", 1, 1D,
            new[]
            {
                "messaging.operation.name:send",
                "messaging.system:aws_sns",
                $"messaging.destination.name:{destinationName}",
                $"messaging.message.type:{destinationName}"
            });
        DogStatsd.Distribution("messaging.client.published.message.bytes", Encoding.UTF8.GetByteCount(publishRequest.Message), 1D,
            new[]
            {
                "messaging.operation.name:receive",
                "messaging.system:aws_sns",
                $"messaging.destination.name:{destinationName}",
                $"messaging.message.type:{destinationName}"
            });
    }
    
    private static string ExtractNameFromArn(string topicArn)
    {
        if (topicArn is null)
        {
            return "";
        }
        
        var arnSplit = topicArn.Split(':');
        if (arnSplit.Length < 4)
        {
            return "";
        }
        
        return arnSplit[5];
    }
}