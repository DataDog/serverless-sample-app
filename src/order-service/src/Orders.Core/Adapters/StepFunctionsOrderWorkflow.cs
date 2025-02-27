// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using Amazon.StepFunctions;
using Amazon.StepFunctions.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Orders.Core.Adapters;

public class StepFunctionsOrderWorkflow(ILogger<StepFunctionsOrderWorkflow> logger, IConfiguration configuration, AmazonStepFunctionsClient stepFunctionsClient) : IOrderWorkflow
{
    public async Task StartWorkflowFor(Order order)
    {
        await stepFunctionsClient.StartExecutionAsync(new StartExecutionRequest()
        {
            StateMachineArn = configuration["ORDER_WORKFLOW_ARN"],
            Name = $"{order.OrderNumber}_{Guid.NewGuid().ToString()}",
            Input = JsonSerializer.Serialize(order, new JsonSerializerOptions()
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            })
        });
    }

    public async Task StockReservationSuccessful(string correlationId)
    {
        await stepFunctionsClient.SendTaskSuccessAsync(new SendTaskSuccessRequest()
        {
            TaskToken = correlationId,
            Output = "{\"result\": \"Stock reserved successfully\"}"
        });
    }

    public async Task StockReservationFailed(string correlationId)
    {
        await stepFunctionsClient.SendTaskFailureAsync(new SendTaskFailureRequest
        {
            Cause = "Stock could not be reserved successfully",
            Error = "Stock.ReservationFailed",
            TaskToken = correlationId,

        });
    }
}