// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SNSEvents;
using Datadog.Trace;
using Orders.Core.InternalEvents;

namespace Orders.BackgroundWorkers;

public class Functions(EventGateway eventGateway)
{
    [LambdaFunction]
    public async Task HandleOrderCreated(SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings()
            {
                Parent = activeSpan?.Context
            });
            record.AddToTelemetry();
            
            try
            {
                var evtData = JsonSerializer.Deserialize<OrderCreatedEvent>(record.Sns.Message);
                
                if (evtData is null)
                    throw new ArgumentException("Event payload does not serialize to a `OrderCreatedEvent`");
                
                await eventGateway.Handle(evtData);

                processingSpan.Close();
            }
            catch (Exception e)
            {
                processingSpan.Span?.SetTag("error.type", e.GetType().Name);
                throw;
            }
            finally
            {
                processingSpan.Close();
            }
        }
    }
}