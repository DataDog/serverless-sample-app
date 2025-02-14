// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.Api;

public class ProductApiStack : Stack
{
    internal ProductApiStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_API_KEY_SECRET_ARN"));

        var serviceName = "DotnetProductApi";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version);

        var api = new ProductApi(this, "DotnetProductApi", new ProductApiProps(sharedProps, secret));

        if (env.ToLower().Equals("test"))
        {
            var testEventHarness = new TestEventHarness(this, "DotnetProductApiTestEventHarness",
                new TestEventHarnessProps(sharedProps,
                    secret, 
                    "ProductId",
                    new List<ITopic>(3)
                {
                    api.ProductCreatedTopic,
                    api.ProductUpdatedTopic,
                    api.ProductDeletedTopic
                }));
        }
    }
}