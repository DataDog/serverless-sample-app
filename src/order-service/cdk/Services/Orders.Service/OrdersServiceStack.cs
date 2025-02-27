// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System;
using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using OrdersService.CDK.Constructs;
using Secret = Amazon.CDK.AWS.SecretsManager.Secret;

namespace OrdersService.CDK.Services.Orders.Service;

public class OrdersServiceStack : Stack
{
    internal OrdersServiceStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_API_KEY_SECRET_ARN"));

        var serviceName = "OrdersService";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version, secret);

        IEventBus? sharedEventBus = null;
        IStringParameter jwtAccessKeyParameter = null;
        var integratedEnvironments = new List<string> {"prod", "dev"};
        
        var orderServiceEventBus = new EventBus(this, "OrdersEventBus", new EventBusProps()
        {
            EventBusName = $"{serviceName}-bus-{env}"
        });
        var ordersEventBusParameter = new StringParameter(this, "OrdersTestEventBusName",
            new StringParameterProps
            {
                ParameterName = $"/{env}/{serviceName}/event-bus-name",
                StringValue = orderServiceEventBus.EventBusName
            });
        var ordersEventBusArnParameter = new StringParameter(this, "OrdersTestEventBusArn",
            new StringParameterProps
            {
                ParameterName = $"/{env}/{serviceName}/event-bus-arn",
                StringValue = orderServiceEventBus.EventBusArn
            });

        if (!integratedEnvironments.Contains(env))
        {
            jwtAccessKeyParameter = new StringParameter(this, "OrdersTestJwtAccessKeyParameter",
                new StringParameterProps
                {
                    ParameterName = $"/{env}/{serviceName}/secret-access-key",
                    StringValue = "This is a sample secret key that should not be used in production`"
                });
        }
        else
        {
            jwtAccessKeyParameter =
                StringParameter.FromStringParameterName(this, "JwtAccessKeyParameter", $"/{env}/shared/secret-access-key");

            var eventBusTopicArn = StringParameter.FromStringParameterName(this, "EventBusTopicArn",
                $"/{env}/shared/event-bus-name");
            sharedEventBus = EventBus.FromEventBusName(this, "SharedEventBus", eventBusTopicArn.StringValue);
        }
        
        var stockReservedRule = new Rule(this, "OrderCreatedTestRule", new RuleProps()
        {
            EventBus = orderServiceEventBus,
        });
        stockReservedRule.AddEventPattern(new EventPattern()
        {
            DetailType = ["orders.orderCreated.v1"],
            Source = [$"{sharedProps.Env}.orders"]
        });

        var testEventHarness = new TestEventHarness(this, "OrdersTestEventHarness",
            new TestEventHarnessProps(sharedProps, secret, "orderNumber", new List<ITopic>(), new List<Rule>(){stockReservedRule}));

        var orderApi = new OrdersApi(this, "OrdersApi",
            new OrdersApiProps(sharedProps, jwtAccessKeyParameter, orderServiceEventBus, sharedEventBus));

        var ordersWorker = new OrdersBackgroundWorker(this, "OrdersWorker",
            new OrdersBackgroundWorkerProps(sharedProps, orderServiceEventBus, sharedEventBus, orderApi.OrdersTable, orderApi.OrdersWorkflow));

        // Add forwarding rules for shared event bus
        if (sharedEventBus != null)
        {
            stockReservedRule.AddTarget(new Amazon.CDK.AWS.Events.Targets.EventBus(sharedEventBus));
        }
    }
}