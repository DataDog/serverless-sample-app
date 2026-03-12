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
        return await ProcessBatchAsync(evt, ProcessStockReservedMessageAsync);
    }

    private async Task<bool> ProcessStockReservedMessageAsync(SQSEvent.SQSMessage record, CancellationToken cancellationToken)
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
                    await _orderWorkflow.StockReservationSuccessful(evtData.Detail!.Data.ConversationId, ct);
                    return true;
                },
                cancellationToken);

            return true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Processing stock reserved message {MessageId} was cancelled", record.MessageId);
            return false;
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
        return await ProcessBatchAsync(evt, ProcessReservationFailedMessageAsync);
    }

    private async Task<bool> ProcessReservationFailedMessageAsync(SQSEvent.SQSMessage record, CancellationToken cancellationToken)
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
                    await _orderWorkflow.StockReservationFailed(evtData.Detail!.Data.ConversationId, ct);
                    return true;
                },
                cancellationToken);

            return true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Processing reservation failed message {MessageId} was cancelled", record.MessageId);
            return false;
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

    private async Task<SQSBatchResponse> ProcessBatchAsync(
        SQSEvent evt,
        Func<SQSEvent.SQSMessage, CancellationToken, Task<bool>> processMessageAsync)
    {
        using var timeoutCts = new CancellationTokenSource(MAX_PROCESSING_TIME_MS);
        var processingTasks = evt.Records
            .Select(record => processMessageAsync(record, timeoutCts.Token))
            .ToArray();

        try
        {
            var results = await Task.WhenAll(processingTasks);
            var batchItemFailures = results
                .Select((processed, index) => new { processed, index })
                .Where(result => !result.processed)
                .Select(result => new SQSBatchResponse.BatchItemFailure
                {
                    ItemIdentifier = evt.Records[result.index].MessageId
                })
                .ToList();

            return new SQSBatchResponse
            {
                BatchItemFailures = batchItemFailures
            };
        }
        catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
        {
            _logger.LogError("Batch processing timed out after {Timeout}ms", MAX_PROCESSING_TIME_MS);

            return new SQSBatchResponse
            {
                BatchItemFailures = evt.Records
                    .Select(record => new SQSBatchResponse.BatchItemFailure
                    {
                        ItemIdentifier = record.MessageId
                    })
                    .ToList()
            };
        }
    }
}
