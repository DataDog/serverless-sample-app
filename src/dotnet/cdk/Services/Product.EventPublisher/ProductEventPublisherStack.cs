// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.CDK;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.EventPublisher;

public class ProductEventPublisherStack : Stack {
    
    internal ProductEventPublisherStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_SECRET_ARN"));

        var serviceName = "DotnetProductEventPublisher";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version);
        
        var productCreatedTopicParam = StringParameter.FromStringParameterName(this, "ProductCreatedTopicArn",
            "/dotnet/product-api/product-created-topic");
        var productCreatedTopic = Topic.FromTopicArn(this, "ProductCreatedTopic", productCreatedTopicParam.StringValue);
        var productUpdatedTopicParam = StringParameter.FromStringParameterName(this, "ProductUpdatedTopicArn",
            "/dotnet/product-api/product-updated-topic");
        var productUpdatedTopic = Topic.FromTopicArn(this, "ProductUpdatedTopic", productUpdatedTopicParam.StringValue);
        var productDeletedTopicParam = StringParameter.FromStringParameterName(this, "ProductDeletedTopicArn",
            "/dotnet/product-api/product-deleted-topic");
        var productDeletedTopic = Topic.FromTopicArn(this, "ProductDeletedTopic", productDeletedTopicParam.StringValue);
        
        var eventBusTopicArn =StringParameter.FromStringParameterName(this, "EventBusTopicArn",
            "/dotnet/shared/event-bus-name");
        var eventBus = EventBus.FromEventBusName(this, "SharedEventBus", eventBusTopicArn.StringValue);

        var productEventPublisher = new ProductEventPublisher(this, "DotnetProductEventPublisher", new ProductEventPublisherProps(sharedProps, secret, productCreatedTopic, productUpdatedTopic, productDeletedTopic, eventBus));
    }
}