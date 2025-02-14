// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.CDK;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SSM;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.Acl;

public class ProductAclServiceStack : Stack
{
    internal ProductAclServiceStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_API_KEY_SECRET_ARN"));

        var serviceName = "DotnetProductAcl";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version);

        var eventBusTopicArn =StringParameter.FromStringParameterName(this, "EventBusTopicArn",
            "/dotnet/shared/event-bus-name");
        var eventBus = EventBus.FromEventBusName(this, "SharedEventBus", eventBusTopicArn.StringValue);

        var api = new ProductAclService(this, "DotnetProductAcl", new ProductAclServiceProps(sharedProps, secret, eventBus));
    }
}