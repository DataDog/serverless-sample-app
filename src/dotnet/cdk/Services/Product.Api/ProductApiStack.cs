using System;
using Amazon.CDK;
using Amazon.CDK.AWS.SecretsManager;
using Constructs;
using EventBus = Amazon.CDK.AWS.Events.EventBus;

namespace ServerlessGettingStarted.CDK.Services.Product.Api;

public class ProductApiStack : Stack {
    
    internal ProductApiStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_SECRET_ARN"));

        var serviceName = "DotnetProductApi";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";

        var api = new ProductApi(this, "DotnetProductApi", new ProductApiProps(serviceName, env, version, secret));
    }
}