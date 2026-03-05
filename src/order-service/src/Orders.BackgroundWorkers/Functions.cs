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
using Polly;
using Polly.Retry;

namespace Orders.BackgroundWorkers;

public class Functions
{
    private readonly IOrderWorkflow _orderWorkflow;
    private readonly ILogger<Functions> _logger;
    private readonly ITracingProvider _tracingProvider;
    private readonly ResiliencePipeline _workflowResiliencePipeline;
    private const int MAX_PROCESSING_TIME_MS = 10000;

    public Functions(IOrderWorkflow orderWorkflow, ILogger<Functions> logger, ITracingProvider tracingProvider)
    {
        _orderWorkflow = orderWorkflow;
        _logger = logger;
        _tracingProvider = tracingProvider;

        var maxRetryAttempts = 2;

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
        evt.AddToTelemetry();

        var batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();
        var processingTasks = new List<Task<bool>>();

        foreach (var record in evt.Records)
        {
            var task = ProcessStockReservedMessageAsync(record);
            processingTasks.Add(task);
        }

        var timeoutTask = Task.Delay(MAX_PROCESSING_TIME_MS);
        var completedTask = await Task.WhenAny(Task.WhenAll(processingTasks), timeoutTask);

        if (completedTask == timeoutTask)
        {
            _logger.LogError("Batch processing timed out after {Timeout}ms", MAX_PROCESSING_TIME_MS);

            for (var i = 0; i < processingTasks.Count; i++)
                if (!processingTasks[i].IsCompleted)
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure
                    {
                        ItemIdentifier = evt.Records[i].MessageId
                    });
        }
        else
        {
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

    private async Task<bool> ProcessStockReservedMessageAsync(SQSEvent.SQSMessage record)
    {
        IScope? processingSpan = null;

        try
        {
            var evtData =
                JsonSerializer.Deserialize<EventBridgeMessageWrapper<EventWrapper<StockReservedEvent>>>(record.Body);

            if (evtData?.Detail?.Data is null)
            {
                _logger.LogWarning("Deserialized event data is null for message {MessageId}", record.MessageId);
                return false;
            }

            var parentContext = _tracingProvider.ExtractContextIncludingDsm(
                JsonDocument.Parse(record.Body),
                GetHeader,
                "eventbridge",
                evtData.Detail.Type);

            processingSpan = _tracingProvider.StartActiveSpan($"process {evtData.Detail.Type}", parentContext);

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
        evt.AddToTelemetry();

        var batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();
        var processingTasks = new List<Task<bool>>();

        foreach (var record in evt.Records)
        {
            var task = ProcessReservationFailedMessageAsync(record);
            processingTasks.Add(task);
        }

        var timeoutTask = Task.Delay(MAX_PROCESSING_TIME_MS);
        var completedTask = await Task.WhenAny(Task.WhenAll(processingTasks), timeoutTask);

        if (completedTask == timeoutTask)
        {
            _logger.LogError("Batch processing timed out after {Timeout}ms", MAX_PROCESSING_TIME_MS);

            for (var i = 0; i < processingTasks.Count; i++)
                if (!processingTasks[i].IsCompleted)
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure
                    {
                        ItemIdentifier = evt.Records[i].MessageId
                    });
        }
        else
        {
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

    private async Task<bool> ProcessReservationFailedMessageAsync(SQSEvent.SQSMessage record)
    {
        IScope? processingSpan = null;

        try
        {
            var evtData =
                JsonSerializer.Deserialize<EventBridgeMessageWrapper<EventWrapper<StockReservationFailedEvent>>>(
                    record.Body);

            if (evtData?.Detail?.Data is null)
            {
                _logger.LogWarning("Deserialized event data is null for message {MessageId}", record.MessageId);
                return false;
            }

            var parentContext = _tracingProvider.ExtractContextIncludingDsm(
                JsonDocument.Parse(record.Body),
                GetHeader,
                "eventbridge",
                evtData.Detail.Type);

            processingSpan = _tracingProvider.StartActiveSpan($"process {evtData.Detail.Type}", parentContext);

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
            processingSpan?.Span.SetException(e);
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
