// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.Events.Targets;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.Acl;

public record ProductAclServiceProps(SharedProps Shared, ISecret DdApiKeySecret, IEventBus SharedEventBus);

public class ProductAclService : Construct
{
    public ProductAclService(Construct scope, string id, ProductAclServiceProps props) : base(scope, id)
    {
        var stockUpdatedHandlerQueue = new ResilientQueue(this, "InventoryStockUpdatedEventQueue",
            new ResilientQueueProps("Product-StockUpdated", props.Shared.Env));

        var stockUpdatedTopic = new Topic(this, "StockUpdated", new TopicProps()
        {
            TopicName = $"DotnetProductStockUpdated-{props.Shared.Env}"
        });

        var apiEnvironmentVariables = new Dictionary<string, string>(2)
        {
            { "STOCK_UPDATED_TOPIC_ARN", stockUpdatedTopic.TopicArn }
        };

        var handleProductCreatedFunction = new InstrumentedFunction(this, "HandleStockUpdatedFunction",
            new FunctionProps(props.Shared, "HandleStockUpdated", "../src/Product.Acl/Product.Acl.Adapters/",
                "Product.Acl.Adapters::Product.Acl.Adapters.HandlerFunctions_HandleInventoryStockUpdate_Generated::HandleInventoryStockUpdate",
                apiEnvironmentVariables, props.DdApiKeySecret));
        stockUpdatedTopic.GrantPublish(handleProductCreatedFunction.Function);
        handleProductCreatedFunction.Function.AddEventSource(new SqsEventSource(stockUpdatedHandlerQueue.Queue,
            new SqsEventSourceProps()
            {
                ReportBatchItemFailures = true,
                BatchSize = 10,
                MaxBatchingWindow = Duration.Seconds(10)
            }));

        var stockUpdatedRule = new Rule(this, "ProductStockUpdatedRule", new RuleProps()
        {
            EventBus = props.SharedEventBus
        });
        stockUpdatedRule.AddEventPattern(new EventPattern()
        {
            DetailType = ["inventory.stockUpdated.v1"],
            Source = [$"{props.Shared.Env}.inventory"]
        });
        stockUpdatedRule.AddTarget(new SqsQueue(stockUpdatedHandlerQueue.Queue));

        var stockUpdatedTopicParam = new StringParameter(this, "ProductStockUpdatedTopicArnParam",
            new StringParameterProps()
            {
                ParameterName = "/dotnet/product-acl/stock-updated-topic",
                StringValue = stockUpdatedTopic.TopicArn
            });
    }
}