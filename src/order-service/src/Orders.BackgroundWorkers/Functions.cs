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
using Orders.Core.Adapters;

namespace Orders.BackgroundWorkers;

public class Functions(IOrderWorkflow orderWorkflow, ILogger<Functions> logger)
{
    [LambdaFunction]
    public async Task<SQSBatchResponse> HandleStockReserved(SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();
        
        var batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();

        foreach (var record in evt.Records)
        {
            IScope? processingSpan = null;
            try
            {
                var evtData = JsonSerializer.Deserialize<EventBridgeMessageWrapper<EventWrapper<StockReservedEvent>>>(record.Body);

                if (evtData?.Detail?.Data is null)
                {
                    logger.LogWarning("Deserialized event data is null from message body {MessageBody}", record.Body);
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure(){ItemIdentifier = record.MessageId});
                    continue;
                }
                
                processingSpan = Tracer.Instance.StartActive($"process {evtData.Detail.Type}", new SpanCreationSettings
                {
                    Parent = activeSpan?.Context,
                });
                record.AddToTelemetry();
                evtData.Detail?.AddToTelemetry();
                evtData.Detail!.Data.OrderNumber.AddToTelemetry("order.id");
                
                await orderWorkflow.StockReservationSuccessful(evtData.Detail!.Data.ConversationId);

                processingSpan?.Close();
            }
            catch (Exception e)
            {
                logger.LogError(e, e.Message);
                processingSpan?.Span.SetException(e);
                batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure(){ItemIdentifier = record.MessageId});
            }
            finally
            {
                processingSpan?.Close();
            }
        }
        
        return new SQSBatchResponse()
        {
            BatchItemFailures = batchItemFailures
        };
    }
    
    [LambdaFunction]
    public async Task<SQSBatchResponse> HandleReservationFailed(SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();
        
        var batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();

        foreach (var record in evt.Records)
        {
            IScope? processingSpan = null;
            
            try
            {
                var evtData = JsonSerializer.Deserialize<EventBridgeMessageWrapper<EventWrapper<StockReservationFailedEvent>>>(record.Body);

                if (evtData?.Detail?.Data is null)
                {
                    logger.LogWarning("Deserialized event data is null from message body {MessageBody}", record.Body);
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure(){ItemIdentifier = record.MessageId});
                    continue;
                }
                
                processingSpan = Tracer.Instance.StartActive($"process {evtData.Detail.Type}", new SpanCreationSettings
                {
                    Parent = activeSpan?.Context,
                });
                
                record.AddToTelemetry();
                evtData.Detail?.AddToTelemetry();
                
                evtData.Detail!.Data.OrderNumber.AddToTelemetry("order.id");
                await orderWorkflow.StockReservationFailed(evtData.Detail!.Data.ConversationId);

                processingSpan.Close();
            }
            catch (Exception e)
            {
                logger.LogError(e, e.Message);
                processingSpan?.Span?.SetTag("error.type", e.GetType().Name);
                batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure(){ItemIdentifier = record.MessageId});
            }
            finally
            {
                processingSpan?.Close();
            }
        }

        return new SQSBatchResponse()
        {
            BatchItemFailures = batchItemFailures
        };
    }
}