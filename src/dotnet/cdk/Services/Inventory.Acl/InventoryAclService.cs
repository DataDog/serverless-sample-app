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

namespace ServerlessGettingStarted.CDK.Services.Inventory.Acl;

public record InventoryAclServiceProps(SharedProps Shared, ISecret DdApiKeySecret, IEventBus SharedEventBus);

public class InventoryAclService : Construct
{
    public InventoryAclService(Construct scope, string id, InventoryAclServiceProps props) : base(scope, id)
    {
        var productAddedHandlerQueue = new ResilientQueue(this, "ProductCreatedEventQueue",
            new ResilientQueueProps("Inventory-ProductCreated", props.Shared.Env));
        var productUpdatedHandlerQueue = new ResilientQueue(this, "ProductUpdatedEventQueue",
            new ResilientQueueProps("Inventory-ProductUpdated", props.Shared.Env));
        
        var newProductAddedTopic = new Topic(this, "NewProductAdded", new TopicProps()
        {
            TopicName = $"DotnetNewProductAdded-{props.Shared.Env}"
        });
        
        var apiEnvironmentVariables = new Dictionary<string, string>(2)
        {
            { "PRODUCT_ADDED_TOPIC_ARN", newProductAddedTopic.TopicArn },
        };
        
        var handleProductCreatedFunction = new InstrumentedFunction(this, "HandleProductCreatedFunction",
            new FunctionProps(props.Shared,"HandleProductCreated", "../src/Inventory.Acl/Inventory.Acl.Adapters/",
                "Inventory.Acl.Adapters::Inventory.Acl.Adapters.HandlerFunctions_HandleCreated_Generated::HandleCreated", apiEnvironmentVariables, props.DdApiKeySecret));
        newProductAddedTopic.GrantPublish(handleProductCreatedFunction.Function);
        handleProductCreatedFunction.Function.AddEventSource(new SqsEventSource(productAddedHandlerQueue.Queue, new SqsEventSourceProps()
        {
            ReportBatchItemFailures = true,
            BatchSize = 10,
            MaxBatchingWindow = Duration.Seconds(10)
        }));
        
        var handleProductUpdatedFunction = new InstrumentedFunction(this, "HandleProductUpdatedFunction",
            new FunctionProps(props.Shared,"HandleProductUpdated", "../src/Inventory.Acl/Inventory.Acl.Adapters/",
                "Inventory.Acl.Adapters::Inventory.Acl.Adapters.HandlerFunctions_HandleCreated_Generated::HandleUpdated", apiEnvironmentVariables, props.DdApiKeySecret));
        newProductAddedTopic.GrantPublish(handleProductUpdatedFunction.Function);
        handleProductUpdatedFunction.Function.AddEventSource(new SqsEventSource(productUpdatedHandlerQueue.Queue, new SqsEventSourceProps()
        {
            ReportBatchItemFailures = true,
            BatchSize = 10,
            MaxBatchingWindow = Duration.Seconds(10)
        }));

        var productCreatedRule = new Rule(this, "InventoryProductCreatedRule", new RuleProps()
        {
            EventBus = props.SharedEventBus,
        });
        productCreatedRule.AddEventPattern(new EventPattern()
        {
            DetailType = ["product.productCreated.v1"],
            Source = [$"{props.Shared.Env}.products"]
        });
        productCreatedRule.AddTarget(new SqsQueue(productAddedHandlerQueue.Queue));
        var productUpdatedRule = new Rule(this, "InventoryProductUpdatedRule", new RuleProps()
        {
            EventBus = props.SharedEventBus,
        });
        productUpdatedRule.AddEventPattern(new EventPattern()
        {
            DetailType = ["product.productUpdated.v1"],
            Source = [$"{props.Shared.Env}.products"]
        });
        productUpdatedRule.AddTarget(new SqsQueue(productUpdatedHandlerQueue.Queue));
        
        var pricingUpdatedTopic = new StringParameter(this, "PricingUpdatedTopicArn",
            new StringParameterProps()
            {
                ParameterName = "/dotnet/inventory-acl/new-product-added-topic",
                StringValue = newProductAddedTopic.TopicArn
            });
    }
}