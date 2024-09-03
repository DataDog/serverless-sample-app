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