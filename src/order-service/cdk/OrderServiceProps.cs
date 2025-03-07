// Unless explicitly stated otherwise all files in scope repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using OrdersService.CDK.Constructs;
using OrdersService.CDK.Events;

namespace OrdersService.CDK;

public record SharedEventBus(IEventBus? EventBus);
public record OrdersServiceEventBus(IEventBus EventBus);

public class OrderServiceProps(
    SharedEventBus? SharedEventBus,
    OrdersServiceEventBus OrdersEventBus,
    IStringParameter JwtSecretAccessKey,
    List<Rule> PublicEvents)
{
    public SharedEventBus SharedEventBus { get; } = SharedEventBus;
    public OrdersServiceEventBus OrdersEventBus { get; } = OrdersEventBus;
    public IStringParameter JwtSecretAccessKey { get; } = JwtSecretAccessKey;
    public List<Rule> PublicEvents { get; } = PublicEvents;

    public static OrderServiceProps Create(Construct scope, SharedProps props)
    {
        var integratedEnvironments = new List<string> {"prod", "dev"};
        
        IEventBus? sharedEventBus = null;
        IStringParameter? jwtAccessKeyParameter = null;
        
        var orderServiceEventBus = new EventBus(scope, "OrdersEventBus", new EventBusProps()
        {
            EventBusName = $"{props.ServiceName}-bus-{props.Env}"
        });
        var ordersEventBusParameter = new StringParameter(scope, "OrdersEventBusNameParameter",
            new StringParameterProps
            {
                ParameterName = $"/{props.Env}/{props.ServiceName}/event-bus-name",
                StringValue = orderServiceEventBus.EventBusName
            });
        var ordersEventBusArnParameter = new StringParameter(scope, "OrdersEventBusArnParameter",
            new StringParameterProps
            {
                ParameterName = $"/{props.Env}/{props.ServiceName}/event-bus-arn",
                StringValue = orderServiceEventBus.EventBusArn
            });
        
        var publicEvents = new List<Rule>()
        {
            new OrderCreatedEventRule(scope, "OrderCreatedRule", props, new RuleProps()
            {
                EventBus = orderServiceEventBus
            }),
            new OrderConfirmedEventRule(scope, "OrderConfirmedRule", props, new RuleProps()
            {
                EventBus = orderServiceEventBus
            }),
            new OrderCompletedEventRule(scope, "OrderCompletedRule", props, new RuleProps()
            {
                EventBus = orderServiceEventBus
            }),
        };

        // Deploy the test harness in all non-production environments.
        if (props.Env != "prod")
        {
            var testEventHarness = new TestEventHarness(scope, "OrdersTestEventHarness",
                new TestEventHarnessProps(props, props.DDApiKeySecret, "orderNumber", new List<ITopic>(), publicEvents));
        }

        if (!integratedEnvironments.Contains(props.Env))
        {
            jwtAccessKeyParameter = new StringParameter(scope, "OrdersTestJwtAccessKeyParameter",
                new StringParameterProps
                {
                    ParameterName = $"/{props.Env}/{props.ServiceName}/secret-access-key",
                    StringValue = "This is a sample secret key that should not be used in production`"
                });
        }
        else
        {
            jwtAccessKeyParameter =
                StringParameter.FromStringParameterName(scope, "JwtAccessKeyParameter", $"/{props.Env}/shared/secret-access-key");

            var eventBusTopicArn = StringParameter.FromStringParameterName(scope, "EventBusTopicArn",
                $"/{props.Env}/shared/event-bus-name");
            sharedEventBus = EventBus.FromEventBusName(scope, "SharedEventBus", eventBusTopicArn.StringValue);
        }

        return new OrderServiceProps(new SharedEventBus(sharedEventBus),
            new OrdersServiceEventBus(orderServiceEventBus), jwtAccessKeyParameter, publicEvents);
    }
}

