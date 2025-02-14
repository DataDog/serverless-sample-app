// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.Pricing;

public record ProductPricingServiceProps(SharedProps Shared, ISecret DdApiKeySecret, ITopic ProductCreatedTopic, ITopic ProductUpdatedTopic);

public class ProductPricingService : Construct
{
    public ProductPricingService(Construct scope, string id, ProductPricingServiceProps props) : base(scope, id)
    {
        var productPricingUpdatedTopic = new Topic(this, "ProductPricingUpdated", new TopicProps()
        {
            TopicName = $"DotnetProductPricingUpdated-{props.Shared.Env}"
        });
        
        var apiEnvironmentVariables = new Dictionary<string, string>(2)
        {
            { "PRICE_CALCULATED_TOPIC_ARN", productPricingUpdatedTopic.TopicArn },
        };
        
        var handleProductCreatedFunction = new InstrumentedFunction(this, "HandleProductCreatedFunction",
            new FunctionProps(props.Shared,"HandleProductCreated", "../src/Product.Pricing/ProductPricingService.Lambda/",
                "ProductPricingService.Lambda::ProductPricingService.Lambda.Functions_HandleProductCreated_Generated::HandleProductCreated", apiEnvironmentVariables, props.DdApiKeySecret));
        handleProductCreatedFunction.Function.AddEventSource(new SnsEventSource(props.ProductCreatedTopic));
        productPricingUpdatedTopic.GrantPublish(handleProductCreatedFunction.Function);
        
        var handleProductUpdatedFunction = new InstrumentedFunction(this, "HandleProductUpdatedFunction",
            new FunctionProps(props.Shared,"HandleProductUpdated", "../src/Product.Pricing/ProductPricingService.Lambda/",
                "ProductPricingService.Lambda::ProductPricingService.Lambda.Functions_HandleProductUpdated_Generated::HandleProductUpdated", apiEnvironmentVariables, props.DdApiKeySecret));
        handleProductUpdatedFunction.Function.AddEventSource(new SnsEventSource(props.ProductUpdatedTopic));
        productPricingUpdatedTopic.GrantPublish(handleProductUpdatedFunction.Function);
        
        var pricingUpdatedTopic = new StringParameter(this, "PricingUpdatedTopicArn",
            new StringParameterProps()
            {
                ParameterName = "/dotnet/product-pricing/pricing-updated-topic",
                StringValue = productPricingUpdatedTopic.TopicArn
            });
    }
}