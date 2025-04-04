// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.Events.Targets;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SQS;
using Amazon.CDK.AWS.StepFunctions;
using Constructs;
using OrdersService.CDK.Constructs;
using EventBus = Amazon.CDK.AWS.Events.Targets.EventBus;

namespace OrdersService.CDK.Services;

public record OrdersBackgroundWorkerProps(
    SharedProps SharedProps,
    OrderServiceProps ServiceProps,
    ITable OrdersTable,
    IStateMachine OrdersWorkflow);

public class OrdersBackgroundWorker : Construct
{
    public OrdersBackgroundWorker(Construct scope, string id, OrdersBackgroundWorkerProps props) : base(scope, id)
    {
        var environmentVariables = new Dictionary<string, string>(2)
        {
            { "EVENT_BUS_NAME", props.ServiceProps.OrdersEventBus.EventBusName },
            { "TABLE_NAME", props.OrdersTable.TableName }
        };

        var describeEventBusPolicy = new Policy(this, "DescribeEventBusPolicy", new PolicyProps()
        {
            PolicyName = $"cdk-{props.SharedProps.ServiceName}-describe-event-bus-{props.SharedProps.Env}",
            Statements = new[]
            {
                new PolicyStatement(new PolicyStatementProps()
                {
                    Effect = Effect.ALLOW,
                    Resources = new[] { props.ServiceProps.OrdersEventBus.EventBusArn },
                    Actions = new[] { "events:DescribeEventBus" }
                })
            }
        });
        
        CreateStockReservedEventAcl(props, describeEventBusPolicy, environmentVariables);
        CreateStockReservationFailedEventAcl(props, describeEventBusPolicy, environmentVariables);
    }

    private void CreateStockReservedEventAcl(OrdersBackgroundWorkerProps props, Policy describeEventBusPolicy, Dictionary<string, string> environmentVariables)
    {
        var stockReservedEventQueue = new ResilientQueue(this, "ProductStockReservedEventQueue",
            new ResilientQueueProps($"{props.SharedProps.ServiceName}-StockReserved", props.SharedProps.Env));

        var handleStockReserved = new InstrumentedFunction(this, "StockReservedACLFunction",
            new FunctionProps(props.SharedProps, "StockReservationSuccessACL", "../src/Orders.BackgroundWorkers/",
                "Orders.BackgroundWorkers::Orders.BackgroundWorkers.Functions_HandleStockReserved_Generated::HandleStockReserved",
                environmentVariables, props.SharedProps.DDApiKeySecret));
        handleStockReserved.Function.AddEventSource(new SqsEventSource(stockReservedEventQueue.Queue));

        handleStockReserved.Function.Role?.AttachInlinePolicy(describeEventBusPolicy);

        props.OrdersTable.GrantReadWriteData(handleStockReserved.Function);
        props.OrdersWorkflow.Grant(handleStockReserved.Function,
            new[] { "states:SendTaskSuccess", "states:SendTaskFailure" });

        AddEventRule("OrdersStockReserved", props, new EventPattern()
        {
            DetailType = ["inventory.stockReserved.v1"],
            Source = [$"{props.SharedProps.Env}.inventory"]
        }, stockReservedEventQueue.Queue);
    }

    private void CreateStockReservationFailedEventAcl(OrdersBackgroundWorkerProps props, Policy describeEventBusPolicy, Dictionary<string, string> environmentVariables)
    {
        var stockReservationFailedEventQueue = new ResilientQueue(this, "ProductStockReservationFailedEventQueue",
            new ResilientQueueProps($"{props.SharedProps.ServiceName}-StockReservationFailedACL", props.SharedProps.Env));
        
        var handleOutOfStock = new InstrumentedFunction(this, "StockReservationFailedACLFunction",
            new FunctionProps(props.SharedProps, "HandleStockReservationFailed", "../src/Orders.BackgroundWorkers/",
                "Orders.BackgroundWorkers::Orders.BackgroundWorkers.Functions_HandleReservationFailed_Generated::HandleReservationFailed",
                environmentVariables, props.SharedProps.DDApiKeySecret));
        handleOutOfStock.Function.AddEventSource(new SqsEventSource(stockReservationFailedEventQueue.Queue));

        handleOutOfStock.Function.Role?.AttachInlinePolicy(describeEventBusPolicy);

        props.OrdersTable.GrantReadWriteData(handleOutOfStock.Function);
        props.OrdersWorkflow.Grant(handleOutOfStock.Function,
            new[] { "states:SendTaskSuccess", "states:SendTaskFailure" });

        AddEventRule("OrdersStockReservationFailed", props, new EventPattern()
        {
            DetailType = ["inventory.stockReservationFailed.v1"],
            Source = [$"{props.SharedProps.Env}.inventory"]
        }, stockReservationFailedEventQueue.Queue);
    }
    
    private void AddEventRule(string name, OrdersBackgroundWorkerProps props, EventPattern pattern, IQueue target)
    {
        if (props.ServiceProps.SharedEventBus != null)
        {
            var sharedBusRule = new Rule(this, $"{name}SharedBusRule", new RuleProps()
            {
                EventBus = props.ServiceProps.SharedEventBus
            });
            sharedBusRule.AddEventPattern(pattern);
            sharedBusRule.AddTarget(new EventBus(props.ServiceProps.OrdersEventBus));
        }

        var ordersBusRule = new Rule(this, $"{name}OrdersBusRule", new RuleProps()
        {
            EventBus = props.ServiceProps.OrdersEventBus
        });
        ordersBusRule.AddEventPattern(pattern);
        ordersBusRule.AddTarget(new SqsQueue(target));
    }
}