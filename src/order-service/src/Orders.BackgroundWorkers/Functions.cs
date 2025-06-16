// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Diagnostics;
using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SQSEvents;
using Datadog.Trace;
using Microsoft.Extensions.Logging;
using Orders.BackgroundWorkers.ExternalEvents;
using Orders.Core;
using Orders.Core.Adapters;
using Polly;
using Polly.Retry;
using Serilog;

namespace Orders.BackgroundWorkers;

public class Functions
{
    private readonly IOrderWorkflow _orderWorkflow;
    private readonly ILogger<Functions> _logger;
    private readonly ResiliencePipeline _workflowResiliencePipeline;
    private const int MAX_PROCESSING_TIME_MS = 10000; // 10 seconds max processing time per message

    public Functions(IOrderWorkflow orderWorkflow, ILogger<Functions> logger)
    {
        _orderWorkflow = orderWorkflow;
        _logger = logger;

        var maxRetryAttempts = 2;

        // Create resilience pipeline for workflow operations
        _workflowResiliencePipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                ShouldHandle = new PredicateBuilder()
                    .Handle<TimeoutException>()
                    .Handle<HttpRequestException>(),
                MaxRetryAttempts = maxRetryAttempts,
                BackoffType = DelayBackoffType.Exponential,
                Delay = TimeSpan.FromMilliseconds(200),
                OnRetry = args =>
                {
                    _logger.LogWarning(args.Outcome.Exception,
                        "Workflow operation failed. Retrying {RetryCount}/{MaxRetryCount}",
                        args.AttemptNumber, maxRetryAttempts);
                    return ValueTask.CompletedTask;
                }
            })
            .AddTimeout(TimeSpan.FromMilliseconds(MAX_PROCESSING_TIME_MS / 2))
            .Build();
    }

    [LambdaFunction]
    public async Task<SQSBatchResponse> HandleStockReserved(SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        var batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();
        var processingTasks = new List<Task<bool>>();

        foreach (var record in evt.Records)
        {
            var task = ProcessStockReservedMessageAsync(record, activeSpan);
            processingTasks.Add(task);
        }

        // Process all messages with a timeout
        var timeoutTask = Task.Delay(MAX_PROCESSING_TIME_MS);
        var completedTask = await Task.WhenAny(Task.WhenAll(processingTasks), timeoutTask);

        if (completedTask == timeoutTask)
        {
            _logger.LogError("Batch processing timed out after {Timeout}ms", MAX_PROCESSING_TIME_MS);

            // Add all records that haven't completed as failures
            for (var i = 0; i < processingTasks.Count; i++)
                if (!processingTasks[i].IsCompleted)
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure
                    {
                        ItemIdentifier = evt.Records[i].MessageId
                    });
        }
        else
        {
            // Add failures for any task that returned false
            for (var i = 0; i < processingTasks.Count; i++)
                if (!processingTasks[i].Result)
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure
                    {
                        ItemIdentifier = evt.Records[i].MessageId
                    });
        }

        return new SQSBatchResponse
        {
            BatchItemFailures = batchItemFailures
        };
    }

    private async Task<bool> ProcessStockReservedMessageAsync(SQSEvent.SQSMessage record, ISpan? parentSpan)
    {
        IScope? processingSpan = null;

        try
        {
            var evtData =
                JsonSerializer.Deserialize<EventBridgeMessageWrapper<EventWrapper<StockReservedEvent>>>(record.Body);

            if (evtData?.Detail?.Data is null)
            {
                _logger.LogWarning("Deserialized event data is null from message body {MessageBody}", record.Body);
                return false;
            }

            var parentContext = new SpanContextExtractor().ExtractIncludingDsm(
                JsonDocument.Parse(record.Body),
                GetHeader,
                "sns",
                evtData.Detail.Type);

            processingSpan = Tracer.Instance.StartActive($"process {evtData.Detail.Type}", new SpanCreationSettings
            {
                Parent = parentSpan?.Context
            });

            record.AddToTelemetry();
            evtData.Detail?.AddToTelemetry();
            evtData.Detail!.Data.OrderNumber.AddToTelemetry("order.id");

            var result = await _workflowResiliencePipeline.ExecuteAsync(
                async ct =>
                {
                    await _orderWorkflow.StockReservationSuccessful(evtData.Detail!.Data.ConversationId);
                    return true;
                },
                CancellationToken.None);

            return true;
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error processing stock reserved message: {ErrorMessage}", e.Message);
            processingSpan?.Span.SetException(e);
            return false;
        }
        finally
        {
            processingSpan?.Close();
        }
    }

    [LambdaFunction]
    public async Task<SQSBatchResponse> HandleReservationFailed(SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        var batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();
        var processingTasks = new List<Task<bool>>();

        foreach (var record in evt.Records)
        {
            var task = ProcessReservationFailedMessageAsync(record, activeSpan);
            processingTasks.Add(task);
        }

        // Process all messages with a timeout
        var timeoutTask = Task.Delay(MAX_PROCESSING_TIME_MS);
        var completedTask = await Task.WhenAny(Task.WhenAll(processingTasks), timeoutTask);

        if (completedTask == timeoutTask)
        {
            _logger.LogError("Batch processing timed out after {Timeout}ms", MAX_PROCESSING_TIME_MS);

            // Add all records that haven't completed as failures
            for (var i = 0; i < processingTasks.Count; i++)
                if (!processingTasks[i].IsCompleted)
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure
                    {
                        ItemIdentifier = evt.Records[i].MessageId
                    });
        }
        else
        {
            // Add failures for any task that returned false
            for (var i = 0; i < processingTasks.Count; i++)
                if (!processingTasks[i].Result)
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure
                    {
                        ItemIdentifier = evt.Records[i].MessageId
                    });
        }

        return new SQSBatchResponse
        {
            BatchItemFailures = batchItemFailures
        };
    }

    private async Task<bool> ProcessReservationFailedMessageAsync(SQSEvent.SQSMessage record, ISpan? parentSpan)
    {
        IScope? processingSpan = null;

        try
        {
            var evtData =
                JsonSerializer.Deserialize<EventBridgeMessageWrapper<EventWrapper<StockReservationFailedEvent>>>(
                    record.Body);

            if (evtData?.Detail?.Data is null)
            {
                _logger.LogWarning("Deserialized event data is null from message body {MessageBody}", record.Body);
                return false;
            }

            var parentContext = new SpanContextExtractor().ExtractIncludingDsm(
                JsonSerializer.SerializeToDocument(evtData.Detail),
                GetHeader,
                "sns",
                evtData.Detail.Type);

            processingSpan = Tracer.Instance.StartActive($"process {evtData.Detail.Type}", new SpanCreationSettings
            {
                Parent = parentSpan?.Context
            });

            record.AddToTelemetry();
            evtData.Detail?.AddToTelemetry();

            evtData.Detail!.Data.OrderNumber.AddToTelemetry("order.id");

            var result = await _workflowResiliencePipeline.ExecuteAsync(
                async ct =>
                {
                    await _orderWorkflow.StockReservationFailed(evtData.Detail!.Data.ConversationId);
                    return true;
                },
                CancellationToken.None);

            return true;
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error processing reservation failed message: {ErrorMessage}", e.Message);
            processingSpan?.Span?.SetTag("error.type", e.GetType().Name);
            return false;
        }
        finally
        {
            processingSpan?.Close();
        }
    }

    private static IEnumerable<string?> GetHeader(JsonDocument doc, string key)
    {
        if (doc.RootElement.TryGetProperty("detail", out var detailProperty))
        {
            if (detailProperty.TryGetProperty("_datadog", out var datadogProperty))
            {
                if (datadogProperty.TryGetProperty(key, out var value))
                {
                    yield return value.GetString();
                }
            }
        }
    }
}