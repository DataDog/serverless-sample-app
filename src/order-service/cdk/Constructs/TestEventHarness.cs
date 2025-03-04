// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Collections.Generic;
using System.Linq;
using Amazon.CDK;
using Amazon.CDK.AWS.APIGateway;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.Events.Targets;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;

namespace OrdersService.CDK.Constructs;

public record TestEventHarnessProps(SharedProps Shared, ISecret DdApiKeySecret, string JsonPropertyKeyName, List<ITopic> SnsTopics, List<Rule> EventBridgeRules);

public class TestEventHarness : Construct
{
    private ITable TestEventTable;
    public TestEventHarness(Construct scope, string id, TestEventHarnessProps props) : base(scope, id)
    {
        TestEventTable = new Table(this, $"DotnetEvts{props.Shared.ServiceName}-{props.Shared.Env}-{props.Shared.Version}", new TableProps()
        {
            TableName = $"{props.Shared.ServiceName}-Events-{props.Shared.Env}-{props.Shared.Version}",
            TableClass = TableClass.STANDARD,
            BillingMode = BillingMode.PAY_PER_REQUEST,
            PartitionKey = new Attribute()
            {
                Name = "PK",
                Type = AttributeType.STRING
            },
            SortKey = new Attribute()
            {
                Name = "SK",
                Type = AttributeType.STRING
            },
            RemovalPolicy = RemovalPolicy.DESTROY
        });
        
        var apiEnvironmentVariables = new Dictionary<string, string>(2)
        {
            { "TABLE_NAME", TestEventTable.TableName },
        };
        var eventApiFunction = new InstrumentedFunction(this, $"EventHarnessApiFunction-{props.Shared.ServiceName}-{props.Shared.Env}-{props.Shared.Version}", 
            new FunctionProps(props.Shared,$"TestApi-{props.Shared.ServiceName}-{props.Shared.Env}-{props.Shared.Version}", "../src/TestHarness/TestHarness.Lambda",
                "TestHarness.Lambda::TestHarness.Lambda.ApiFunctions_GetReceivedEvents_Generated::GetReceivedEvents", apiEnvironmentVariables, props.DdApiKeySecret));
        TestEventTable.GrantReadData(eventApiFunction.Function);
        
        var httpAPi = new RestApi(this, $"TestEventApi{props.Shared.ServiceName}-${props.Shared.Env}-${props.Shared.Version}", new RestApiProps()
        {
            DefaultCorsPreflightOptions = new CorsOptions()
            {
                AllowHeaders = ["*"],
                AllowOrigins = ["http://localhost:8080"],
                AllowMethods = ["GET", "POST", "PUT", "DELETE"],
            }
        });
        var productResource = httpAPi.Root.AddResource("events");
        
        var specificProductResource = productResource.AddResource("{eventId}");
        specificProductResource.AddMethod("GET", new LambdaIntegration(eventApiFunction.Function));
        
        var apiEndpointParam = new StringParameter(this, "TestEventHarnessApiEndpoint", new StringParameterProps()
        {
            ParameterName = $"/{props.Shared.Env}/{props.Shared.ServiceName}_TestHarness/api-endpoint",
            StringValue = httpAPi.Url
        });

        if (props.SnsTopics != null && props.SnsTopics.Any())
        {
            var snsHandlerEnvVariables = new Dictionary<string, string>(2)
            {
                { "TABLE_NAME", TestEventTable.TableName },
                { "KEY_PROPERTY_NAME", props.JsonPropertyKeyName }
            };
            var handlerFunction = new InstrumentedFunction(this, $"EventHarnessSns-{props.Shared.ServiceName}-{props.Shared.Env}-{props.Shared.Version}", 
                new FunctionProps(props.Shared,$"SnsEvent-{props.Shared.ServiceName}-{props.Shared.Env}-{props.Shared.Version}", "../src/TestHarness/TestHarness.Lambda",
                    "TestHarness.Lambda::TestHarness.Lambda.HandlerFunctions_HandleSns_Generated::HandleSns", snsHandlerEnvVariables, props.DdApiKeySecret));
            TestEventTable.GrantReadWriteData(handlerFunction.Function);

            foreach (var topic in props.SnsTopics)
            {
                handlerFunction.Function.AddEventSource(new SnsEventSource(topic));
            }
        }

        if (props.EventBridgeRules != null && props.EventBridgeRules.Any())
        {
            var eventBridgeHandlerVariables = new Dictionary<string, string>(2)
            {
                { "TABLE_NAME", TestEventTable.TableName },
                { "KEY_PROPERTY_NAME", props.JsonPropertyKeyName }
            };
            var handlerFunction = new InstrumentedFunction(this, $"EventHarnessEventBridge-{props.Shared.ServiceName}-{props.Shared.Env}-{props.Shared.Version}", 
                new FunctionProps(props.Shared,$"EBEvent-{props.Shared.ServiceName}-{props.Shared.Env}-{props.Shared.Version}", "../src/TestHarness/TestHarness.Lambda",
                    "TestHarness.Lambda::TestHarness.Lambda.HandlerFunctions_HandleEventBridge_Generated::HandleEventBridge", eventBridgeHandlerVariables, props.DdApiKeySecret));
            TestEventTable.GrantReadWriteData(handlerFunction.Function);

            foreach (var rule in props.EventBridgeRules)
            {
                rule.AddTarget(new LambdaFunction(handlerFunction.Function));
            }
        }
    }
}