// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SQSEvents;
using Datadog.Trace;
using Product.Acl.Core;
using Product.Acl.Core.ExternalEvents;

namespace Product.Acl.Adapters;

public class HandlerFunctions(EventAdapter eventAdapter)
{
    [LambdaFunction]
    public async Task HandleInventoryStockUpdate(SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();
        
        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings
            {
                Parent = activeSpan?.Context,
            });

            try
            {
                record.AddToTelemetry();
                using var timer = record.StartProcessingTimer();

                var evtData = JsonSerializer.Deserialize<EventBridgeMessageWrapper<InventoryStockUpdated>>(record.Body);

                if (evtData?.Detail is null)
                {
                    throw new ArgumentException("Event payload does not serialize to a `InventoryStockUpdated`");
                }

                await eventAdapter.Handle(evtData.Detail);

                processingSpan.Close();
                record.AddProcessingMetrics();
            }
            catch (Exception e)
            {
                record.AddProcessingMetrics(e);
                throw;
            }
            finally
            {
                processingSpan.Close();
            }
        }
    }
}