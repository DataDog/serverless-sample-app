// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.StepFunctions;
using Amazon.StepFunctions.Model;
using Datadog.Trace;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Orders.Core.Telemetry;
using Polly;

namespace Orders.Core.Adapters;

public class StepFunctionsOrderWorkflow : IOrderWorkflow
{
    private readonly IConfiguration _configuration;
    private readonly ITransactionTracker _transactionTracker;
    private readonly AmazonStepFunctionsClient _stepFunctionsClient;
    private readonly ILogger<StepFunctionsOrderWorkflow> _logger;
    private readonly ResiliencePipeline<StartExecutionResponse> _startExecutionResiliencePipeline;
    private readonly ResiliencePipeline<SendTaskSuccessResponse> _taskSuccessResiliencePipeline;
    private readonly ResiliencePipeline<SendTaskFailureResponse> _taskFailureResiliencePipeline;

    public StepFunctionsOrderWorkflow(
        IConfiguration configuration, 
        ITransactionTracker transactionTracker,
        AmazonStepFunctionsClient stepFunctionsClient,
        ILogger<StepFunctionsOrderWorkflow> logger)
    {
        _configuration = configuration;
        _transactionTracker = transactionTracker;
        _stepFunctionsClient = stepFunctionsClient;
        _logger = logger;
        _startExecutionResiliencePipeline = ResiliencePolicies.GetStepFunctionsPolicy<StartExecutionResponse>(logger);
        _taskSuccessResiliencePipeline = ResiliencePolicies.GetStepFunctionsPolicy<SendTaskSuccessResponse>(logger);
        _taskFailureResiliencePipeline = ResiliencePolicies.GetStepFunctionsPolicy<SendTaskFailureResponse>(logger);
    }
    
    public async Task StartWorkflowFor(Order order, CancellationToken cancellationToken = default)
    {
        var inputNode = JsonSerializer.SerializeToNode(order, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        }) ?? new JsonObject();

        inputNode["_datadog"] = new JsonObject();

        var activeContext = Tracer.Instance.ActiveScope?.Span.Context;
        if (activeContext != null)
        {
            new SpanContextInjector().InjectIncludingDsm(
                inputNode,
                SetHeader,
                activeContext,
                "stepfunctions",
                "orders.orderCreated.v1");
        }

        var startExecutionRequest = new StartExecutionRequest()
        {
            StateMachineArn = _configuration["ORDER_WORKFLOW_ARN"],
            Name = $"{order.OrderNumber}_{Guid.NewGuid()}",
            Input = inputNode.ToJsonString()
        };
        startExecutionRequest.AddToTelemetry();
        
        try 
        {
            var result = await _startExecutionResiliencePipeline.ExecuteAsync(
                async ct => await _stepFunctionsClient.StartExecutionAsync(startExecutionRequest, ct),
                cancellationToken);
                
            result.AddToTelemetry();

            await _transactionTracker.TrackTransactionAsync(order.OrderNumber, "order.startWorkflow");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start workflow for order {OrderNumber}", order.OrderNumber);
            throw;
        }
    }

    public async Task StockReservationSuccessful(string correlationId, CancellationToken cancellationToken = default)
    {
        correlationId.AddToTelemetry("conversationId");
        var request = new SendTaskSuccessRequest()
        {
            TaskToken = correlationId,
            Output = "{\"result\": \"Stock reserved successfully\"}"
        };
        
        try 
        {
            var response = await _taskSuccessResiliencePipeline.ExecuteAsync(
                async ct => await _stepFunctionsClient.SendTaskSuccessAsync(request, ct),
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send task success for conversation {ConversationId}", correlationId);
            throw;
        }
    }

    private static void SetHeader(JsonNode carrier, string key, string value)
    {
        if (carrier["_datadog"] == null) carrier["_datadog"] = new JsonObject();

        carrier["_datadog"]![key] = value;
    }

    public async Task StockReservationFailed(string correlationId, CancellationToken cancellationToken = default)
    {
        correlationId.AddToTelemetry("conversationId");
        
        var request = new SendTaskFailureRequest
        {
            Cause = "Stock could not be reserved successfully",
            Error = "Stock.ReservationFailed",
            TaskToken = correlationId,
        };
        
        try 
        {
            await _taskFailureResiliencePipeline.ExecuteAsync(
                async ct => await _stepFunctionsClient.SendTaskFailureAsync(request, ct),
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send task failure for conversation {ConversationId}", correlationId);
            throw;
        }
    }
}
