// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.CloudWatchEvents;
using Amazon.Lambda.SNSEvents;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;

namespace TestHarness.Lambda;

public class HandlerFunctions(IEventStore eventStore)
{
    [LambdaFunction]
    public async Task HandleSns(SNSEvent evt)
    {
        Logger.LogInformation("Handling SNS Event");

        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        foreach (var record in evt.Records)
        {
            Logger.LogInformation("Handling SNS message from {TopicArn}", record.Sns.TopicArn);

            using var processingSpan = Tracer.Instance.StartActive($"process {record.Sns.TopicArn}", new SpanCreationSettings()
            {
                Parent = activeSpan?.Context
            });

            try
            {
                record.AddToTelemetry();

                using var document = JsonDocument.Parse(record.Sns.Message);
                var root = document.RootElement;

                var keyName = Environment.GetEnvironmentVariable("KEY_PROPERTY_NAME") ?? "unknown";

                if (root.TryGetProperty(keyName, out JsonElement orderIdentifierElement))
                {
                    await eventStore.Store(new ReceivedEvent(orderIdentifierElement.GetString() ?? "unknown", record.Sns.Message, record.Sns.TopicArn, DateTime.Now, record.Sns.TopicArn));
                }
                else
                {
                    Logger.LogInformation("Key property named {KeyName} not found", keyName);
                }
            }
            catch (Exception e)
            {
                Logger.LogError(e, "Failure processing event");
                processingSpan.Span.SetException(e);
            }
        }
    }
    
    [LambdaFunction]
    public async Task HandleEventBridge(CloudWatchEvent<JsonObject> evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;

        Logger.LogInformation("Handling EventBridge event from {Source} with type {DetailType}", evt.Source, evt.DetailType);

        using var processingSpan = Tracer.Instance.StartActive($"process {evt.DetailType}", new SpanCreationSettings()
        {
            Parent = activeSpan?.Context
        });

        try
        {
            using var document = JsonDocument.Parse(evt.Detail.ToJsonString());
            var root = document.RootElement;

            var keyName = Environment.GetEnvironmentVariable("KEY_PROPERTY_NAME") ?? "unknown";

            string? conversationId = null;

            if (root.TryGetProperty("conversationId", out JsonElement conversationIdElement))
            {
                conversationId = conversationIdElement.GetString();
            }

            if (root.TryGetProperty("data", out JsonElement dataElement))
            {
                if (dataElement.TryGetProperty(keyName, out JsonElement childOrderIdentifierElement))
                {
                    await eventStore.Store(new ReceivedEvent(childOrderIdentifierElement.GetString() ?? "unknown", evt.Detail.ToJsonString(), evt.DetailType, DateTime.Now, evt.Source, conversationId));
                }

                return;
            }

            Logger.LogInformation("Data property not found in event from {Source}", evt.Source);

            if (root.TryGetProperty(keyName, out JsonElement orderIdentifierElement))
            {
                await eventStore.Store(new ReceivedEvent(orderIdentifierElement.GetString() ?? "unknown", evt.Detail.ToJsonString(), evt.DetailType, DateTime.Now, evt.Source, conversationId));
            }
        }
        catch (Exception e)
        {
            Logger.LogError(e, "Failure processing event");
            processingSpan.Span.SetException(e);
        }
    }
}