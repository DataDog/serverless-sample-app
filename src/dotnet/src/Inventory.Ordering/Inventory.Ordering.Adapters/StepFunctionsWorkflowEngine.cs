// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.StepFunctions;
using Amazon.StepFunctions.Model;
using Inventory.Ordering.Core;
using Microsoft.Extensions.Configuration;

namespace Inventory.Ordering.Adapters;

public class StepFunctionsWorkflowEngine(AmazonStepFunctionsClient stepFunctionsClient, IConfiguration configuration) : IOrderWorkflowEngine
{
    public async Task StartWorkflowFor(string productId)
    {
        await stepFunctionsClient.StartExecutionAsync(new StartExecutionRequest()
        {
            StateMachineArn = configuration["ORDERING_SERVICE_WORKFLOW_ARN"],
            Input = $"{{\"productId\":\"{productId}\"}}"
        });
    }
}