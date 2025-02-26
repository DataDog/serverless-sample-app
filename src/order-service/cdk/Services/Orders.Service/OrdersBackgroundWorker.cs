// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SQS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using OrdersService.CDK.Constructs;
using Policy = Amazon.CDK.AWS.SNS.Policy;

namespace OrdersService.CDK.Services.Orders.Service;

public record OrdersBackgroundWorkerProps(
    SharedProps SharedProps,
    IEventBus SharedEventBus,
    ITable OrdersTable,
    ITopic OrderCreatedTopic,
    IStringParameter ProductApiEndpointParameter);

public class OrdersBackgroundWorker : Construct
{
    public OrdersBackgroundWorker(Construct scope, string id, OrdersBackgroundWorkerProps props) : base(scope, id)
    {
        var environmentVariables = new Dictionary<string, string>(2)
        {
            { "PRODUCT_API_ENDPOINT_PARAMETER", props.ProductApiEndpointParameter.ParameterName },
            { "EVENT_BUS_NAME", props.SharedEventBus.EventBusName },
            { "TABLE_NAME", props.OrdersTable.TableName } 
        };

        var handleOrderCreated = new InstrumentedFunction(this, "HandleOrderCreatedFunction",
            new FunctionProps(props.SharedProps, "HandleOrderCreated", "../src/Orders.BackgroundWorkers/",
                "Orders.BackgroundWorkers::Orders.BackgroundWorkers.Functions_HandleOrderCreated_Generated::HandleOrderCreated",
                environmentVariables, props.SharedProps.DDApiKeySecret));
        handleOrderCreated.Function.AddEventSource(new SnsEventSource(props.OrderCreatedTopic, new SnsEventSourceProps
        {
            DeadLetterQueue = new Queue(this,
                "OrderCreatedHandlerQueue",
                new QueueProps()
                {
                    QueueName = $"{props.SharedProps.ServiceName}-OrderCreatedHandlerDLQ-{props.SharedProps.Env}"
                })
        }));
        handleOrderCreated.Function.Role?.AttachInlinePolicy(new Amazon.CDK.AWS.IAM.Policy(this, "DescribeEventBusPolicy", new PolicyProps()
        {
            PolicyName = "allow-describe-event-bus",
            Statements = new []
            {
                new PolicyStatement(new PolicyStatementProps()
                {
                    Effect = Effect.ALLOW,
                    Resources = new[] { props.SharedEventBus.EventBusArn },
                    Actions = new[] { "events:DescribeEventBus" }
                })
            }
        }));

        props.OrdersTable.GrantReadWriteData(handleOrderCreated.Function);
        props.SharedEventBus.GrantPutEventsTo(handleOrderCreated.Function);
        props.ProductApiEndpointParameter.GrantRead(handleOrderCreated.Function);
    }
}