// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.ECS;
using Amazon.CDK.AWS.ECS.Patterns;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.SSM;
using Constructs;
using OrdersService.CDK.Constructs;
using HealthCheck = Amazon.CDK.AWS.ElasticLoadBalancingV2.HealthCheck;
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

        var jwtAccessKeyParameter =
            StringParameter.FromStringParameterName(this, "JwtAccessKeyParameter", $"/{env}/shared/secret-access-key");
        var productApiEndpointParameter = StringParameter.FromStringParameterName(this, "ProductApiEndpointParameter",
            $"/{env}/ProductManagementService/api-endpoint");

        var eventBusTopicArn = StringParameter.FromStringParameterName(this, "EventBusTopicArn",
            $"/{env}/shared/event-bus-name");
        var eventBus = EventBus.FromEventBusName(this, "SharedEventBus", eventBusTopicArn.StringValue);

        var orderApi = new OrdersApi(this, "OrdersApi",
            new OrdersApiProps(sharedProps, jwtAccessKeyParameter, productApiEndpointParameter, eventBus));

        var ordersWorker = new OrdersBackgroundWorker(this, "OrdersWorker",
            new OrdersBackgroundWorkerProps(sharedProps, eventBus, orderApi.OrdersTable, orderApi.OrderCreatedTopic, productApiEndpointParameter));
    }
}