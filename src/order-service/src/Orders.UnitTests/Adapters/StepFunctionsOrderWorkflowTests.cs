// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.StepFunctions;
using Amazon.StepFunctions.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Orders.Core;
using Orders.Core.Adapters;

namespace Orders.UnitTests.Adapters;

public class StepFunctionsOrderWorkflowTests
{
    private readonly Mock<AmazonStepFunctionsClient> _stepFunctionsClient;
    private readonly StepFunctionsOrderWorkflow _sut;
    private StartExecutionRequest? _capturedRequest;

    public StepFunctionsOrderWorkflowTests()
    {
        _stepFunctionsClient = new Mock<AmazonStepFunctionsClient>();
        _stepFunctionsClient
            .Setup(c => c.StartExecutionAsync(It.IsAny<StartExecutionRequest>(), It.IsAny<CancellationToken>()))
            .Callback<StartExecutionRequest, CancellationToken>((req, _) => _capturedRequest = req)
            .ReturnsAsync(new StartExecutionResponse
            {
                ExecutionArn = "arn:aws:states:us-east-1:123456789:execution:test:test-execution"
            });

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ORDER_WORKFLOW_ARN"] = "arn:aws:states:us-east-1:123456789:stateMachine:test",
                ["AWS_REGION"] = "us-east-1"
            })
            .Build();

        var logger = new Mock<ILogger<StepFunctionsOrderWorkflow>>();

        _sut = new StepFunctionsOrderWorkflow(configuration, _stepFunctionsClient.Object, logger.Object);
    }

    [Fact]
    public async Task StartWorkflowFor_ShouldIncludeDatadogKeyInInput()
    {
        var order = Order.CreateStandardOrder("user-1", new[] { "product-1" });

        await _sut.StartWorkflowFor(order);

        _capturedRequest.Should().NotBeNull();
        var inputNode = JsonNode.Parse(_capturedRequest!.Input);
        inputNode.Should().NotBeNull();
        inputNode!["_datadog"].Should().NotBeNull("the Step Functions input must include _datadog for trace propagation through the workflow");
    }
}
