// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Amazon.CDK.AWS.StepFunctions;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;
using LogGroupProps = Amazon.CDK.AWS.Logs.LogGroupProps;

namespace ServerlessGettingStarted.CDK.Services.Inventory.Ordering;

public record InventoryOrderingServiceProps(SharedProps Shared, ISecret DdApiKeySecret, ITopic NewProductAddedTopic);

public class InventoryOrderingService : Construct
{
    public InventoryOrderingService(Construct scope, string id, InventoryOrderingServiceProps props) : base(scope, id)
    {
        var workflowLogGroup = new LogGroup(this, "DotnetInventoryOrderingWorkflowLogGroup", new LogGroupProps()
        {
            LogGroupName = $"/aws/vendedlogs/states/DotnetInventoryOrderingWorkflowLogGroup-{props.Shared.Env}",
            RemovalPolicy = RemovalPolicy.DESTROY
        });

        var inventoryApiTableParam = StringParameter.FromStringParameterName(this, "DotnetInventoryApiTableParam",
            $"/dotnet/{props.Shared.Env}/inventory-api/table-name");

        var table = Table.FromTableName(this, "DotnetInventoryApiTable", inventoryApiTableParam.StringValue);
        
        var workflow = new StateMachine(this, "DotnetInventoryOrderingWorkflow", new StateMachineProps()
        {
            StateMachineName = $"DotnetInventoryOrderingWorkflow-{props.Shared.Env}",
            DefinitionBody = DefinitionBody.FromFile("../cdk/Services/Inventory.Ordering/workflow/workflow.setStock.asl.json"),
            DefinitionSubstitutions = new Dictionary<string, string>(1)
            {
                {"TableName", table.TableName}
            },
            Logs = new LogOptions()
            {
                Destination = workflowLogGroup,
                IncludeExecutionData = true,
                Level = LogLevel.ALL
            }
        });
        table.GrantReadWriteData(workflow.Role);
        Tags.Of(workflow).Add("DD_ENHANCED_METRICS", "true");
        Tags.Of(workflow).Add("DD_TRACE_ENABLED", "true");

        var apiEnvironmentVariables = new Dictionary<string, string>(1)
        {
            {"ORDERING_SERVICE_WORKFLOW_ARN", workflow.StateMachineArn}
        };

        var handleProductCreatedFunction = new InstrumentedFunction(this, "HandleNewProductAddedFunction",
            new FunctionProps(props.Shared, "HandleNewProductAdded", "../src/Inventory.Ordering/Inventory.Ordering.Adapters/",
                "Inventory.Ordering.Adapters::Inventory.Ordering.Adapters.Functions_HandleProductAdded_Generated::HandleProductAdded", apiEnvironmentVariables, props.DdApiKeySecret));
        workflow.GrantStartExecution(handleProductCreatedFunction.Function);
        handleProductCreatedFunction.Function.AddEventSource(new SnsEventSource(props.NewProductAddedTopic));

        new StringParameter(this, "InventoryOrderingStateMachineArn",
            new StringParameterProps()
            {
                ParameterName = $"/dotnet/{props.Shared.Env}/inventory-ordering/state-machine-arn",
                StringValue = workflow.StateMachineArn
            });
    }
}