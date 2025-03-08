// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SQSEvents;
using Datadog.Trace;
using Microsoft.Extensions.Logging;
using Orders.BackgroundWorkers.ExternalEvents;
using Orders.Core;

namespace Orders.BackgroundWorkers;

public class Functions(IOrderWorkflow orderWorkflow, ILogger<Functions> logger)
{
    [LambdaFunction]
    public async Task HandleStockReserved(SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        foreach (var record in evt.Records)
        {
            IScope? processingSpan = null;
            try
            {
                var evtData = JsonSerializer.Deserialize<EventBridgeMessageWrapper<EventWrapper<StockReservedEvent>>>(record.Body);
                
                processingSpan = Tracer.Instance.StartActive($"process {evtData.Detail.Type}", new SpanCreationSettings
                {
                    Parent = activeSpan?.Context,
                });
                record.AddToTelemetry();
                evtData.Detail?.AddToTelemetry();
                
                if (evtData is null)
                    throw new ArgumentException("Event payload does not serialize to a `StockReservedEvent`");

                await orderWorkflow.StockReservationSuccessful(evtData.Detail!.Data.ConversationId);

                processingSpan?.Close();
            }
            catch (Exception e)
            {
                logger.LogError(e, e.Message);
                processingSpan?.Span.SetException(e);
                throw;
            }
            finally
            {
                processingSpan?.Close();
            }
        }
    }
    
    [LambdaFunction]
    public async Task HandleReservationFailed(SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        foreach (var record in evt.Records)
        {
            IScope? processingSpan = null;
            
            try
            {
                var evtData = JsonSerializer.Deserialize<EventBridgeMessageWrapper<EventWrapper<StockReservationFailedEvent>>>(record.Body);
                
                processingSpan = Tracer.Instance.StartActive($"process {evtData.Detail.Type}", new SpanCreationSettings
                {
                    Parent = activeSpan?.Context,
                });
                
                record.AddToTelemetry();
                evtData.Detail?.AddToTelemetry();
                
                if (evtData is null)
                    throw new ArgumentException("Event payload does not serialize to a `StockReservationFailedEvent`");
                
                await orderWorkflow.StockReservationFailed(evtData.Detail!.Data.ConversationId);

                processingSpan.Close();
            }
            catch (Exception e)
            {
                logger.LogError(e, e.Message);
                processingSpan?.Span?.SetTag("error.type", e.GetType().Name);
                throw;
            }
            finally
            {
                processingSpan?.Close();
            }
        }
    }
}