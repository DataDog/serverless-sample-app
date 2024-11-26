// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.CDK;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Inventory.Ordering;

public class InventoryOrderingServiceStack : Stack
{
    internal InventoryOrderingServiceStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_API_KEY_SECRET_ARN"));

        var serviceName = "DotnetInventoryOrderingService";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version);

        var newProductAddedTopicParam = StringParameter.FromStringParameterName(this, "ProductCreatedTopicArn",
            "/dotnet/inventory-acl/new-product-added-topic");
        var newProductAddedTopic = Topic.FromTopicArn(this, "ProductCreatedTopic", newProductAddedTopicParam.StringValue);

        var api = new InventoryOrderingService(this, "DotnetInventoryOrderingService", new InventoryOrderingServiceProps(sharedProps, secret, newProductAddedTopic));
    }
}