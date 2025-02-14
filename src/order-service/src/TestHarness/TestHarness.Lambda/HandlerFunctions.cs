// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SNSEvents;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;

namespace TestHarness.Lambda;

public class HandlerFunctions(IEventStore eventStore)
{
    [LambdaFunction]
    public async Task HandleSns(SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings()
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
                    await eventStore.Store(new ReceivedEvent(orderIdentifierElement.GetString(), record.Sns.Message, DateTime.Now, record.Sns.TopicArn));
                }
                else
                {
                    Logger.LogInformation($"Key property named '{keyName}'  not found.");
                }

                processingSpan.Close();
            }
            catch (Exception e)
            {
                throw;
            }
            finally
            {
                processingSpan.Close();
            }
        }
    }
}