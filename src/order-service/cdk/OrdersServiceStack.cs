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
using OrdersService.CDK.Events;
using OrdersService.CDK.Services;
using Secret = Amazon.CDK.AWS.SecretsManager.Secret;

namespace OrdersService.CDK;

public class OrdersServiceStack : Stack
{
    internal OrdersServiceStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret", System.Environment.GetEnvironmentVariable("DD_API_KEY_SECRET_ARN") ?? throw new Exception("DD_API_KEY_SECRET_ARN environment variable is not set"));
        var serviceName = "OrdersService";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version, secret);

        var orderServiceProps = OrderServiceProps.Create(this, sharedProps);

        var orderApi = new OrdersApi(this, "OrdersApi",
            new OrdersApiProps(sharedProps, orderServiceProps));

        var ordersWorker = new OrdersBackgroundWorker(this, "OrdersWorker",
            new OrdersBackgroundWorkerProps(sharedProps, orderServiceProps, orderApi.OrdersTable, orderApi.OrdersWorkflow));

        if (orderServiceProps.SharedEventBus.EventBus != null)
        {
            foreach (var rule in orderServiceProps.PublicEvents)
            {
                rule.AddTarget(new Amazon.CDK.AWS.Events.Targets.EventBus(orderServiceProps.SharedEventBus.EventBus));
            }
        }
    }
}