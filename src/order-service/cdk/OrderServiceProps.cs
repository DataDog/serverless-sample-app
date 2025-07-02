// Unless explicitly stated otherwise all files in scope repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System;
using System.Collections.Generic;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using OrdersService.CDK.Constructs;
using OrdersService.CDK.Events;

namespace OrdersService.CDK;

public class OrderServiceProps : Construct
{
    public IEventBus SharedEventBus { get; private init; }
    public IEventBus OrdersEventBus { get; private init; }
    public IStringParameter JwtSecretAccessKey { get; private init; }

    public IEventBus PublisherBus => SharedEventBus == null ? OrdersEventBus : SharedEventBus;

    public IVpc? ExistingVpc { get; private init; } = null;

    public OrderServiceProps(Construct scope, string id, SharedProps props) : base(scope, id)
    {
        var integratedEnvironments = new List<string> { "prod", "dev" };

        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("VPC_ID")))
        {
            var existingVpc = Vpc.FromLookup(this, "ExistingVpc",
                new VpcLookupOptions
                {
                    VpcId = Environment.GetEnvironmentVariable("VPC_ID")
                });
            ExistingVpc = existingVpc;
        }

        OrdersEventBus = new EventBus(scope, "OrdersEventBus", new EventBusProps
        {
            EventBusName = $"{props.ServiceName}-bus-{props.Env}"
        });
        var ordersEventBusParameter = new StringParameter(scope, "OrdersEventBusNameParameter",
            new StringParameterProps
            {
                ParameterName = $"/{props.Env}/{props.ServiceName}/event-bus-name",
                StringValue = OrdersEventBus.EventBusName
            });
        var ordersEventBusArnParameter = new StringParameter(scope, "OrdersEventBusArnParameter",
            new StringParameterProps
            {
                ParameterName = $"/{props.Env}/{props.ServiceName}/event-bus-arn",
                StringValue = OrdersEventBus.EventBusArn
            });

        if (!integratedEnvironments.Contains(props.Env))
        {
            JwtSecretAccessKey = new StringParameter(scope, "OrdersTestJwtAccessKeyParameter",
                new StringParameterProps
                {
                    ParameterName = $"/{props.Env}/{props.ServiceName}/secret-access-key",
                    StringValue = "This is a sample secret key that should not be used in production`"
                });
        }
        else
        {
            JwtSecretAccessKey =
                StringParameter.FromStringParameterName(scope, "JwtAccessKeyParameter",
                    $"/{props.Env}/shared/secret-access-key");

            var eventBusTopicArn = StringParameter.FromStringParameterName(scope, "EventBusTopicArn",
                $"/{props.Env}/shared/event-bus-name");
            SharedEventBus = EventBus.FromEventBusName(scope, "SharedEventBus", eventBusTopicArn.StringValue);
        }

        // Deploy the test harness in all non-production environments.
        if (props.Env != "prod")
        {
            var publicEvents = new List<Rule>
            {
                new OrderCreatedEventRule(scope, "OrderCreatedRule", props, new RuleProps
                {
                    EventBus = PublisherBus
                }),
                new OrderConfirmedEventRule(scope, "OrderConfirmedRule", props, new RuleProps
                {
                    EventBus = PublisherBus
                }),
                new OrderCompletedEventRule(scope, "OrderCompletedRule", props, new RuleProps
                {
                    EventBus = PublisherBus
                })
            };

            var testEventHarness = new TestEventHarness(scope, "OrdersTestEventHarness",
                new TestEventHarnessProps(props, props.DDApiKeySecret, "orderNumber", new List<ITopic>(),
                    publicEvents));
        }
    }
}