using System.Collections.Generic;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.EventPublisher;

public record ProductEventPublisherProps(string ServiceName, string Env, string Version, ISecret DdApiKeySecret, ITopic ProductCreatedTopic, ITopic ProductUpdatedTopic, ITopic ProductDeletedTopic, IEventBus EventBus);

public class ProductEventPublisher : Construct
{
    public ProductEventPublisher(Construct scope, string id, ProductEventPublisherProps props) : base(scope, id)
    {
        var environmentVariables = new Dictionary<string, string>(2)
        {
            { "EVENT_BUS_NAME", props.EventBus.EventBusName },
        };
        
        var handleProductCreated = new InstrumentedFunction(this, "HandleProductCreatedFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"HandleProductCreated", "../src/Product.EventPublisher/ProductEventPublisher.Adapters/",
                "ProductEventPublisher.Adapters::ProductEventPublisher.Adapters.HandlerFunctions_HandleCreated_Generated::HandleCreated", environmentVariables, props.DdApiKeySecret));
        handleProductCreated.Function.AddEventSource(new SnsEventSource(props.ProductCreatedTopic));
        
        var handleProductUpdated = new InstrumentedFunction(this, "HandleProductUpdatedFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"HandleProductUpdated", "../src/Product.EventPublisher/ProductEventPublisher.Adapters/",
                "ProductEventPublisher.Adapters::ProductEventPublisher.Adapters.HandlerFunctions_HandleUpdated_Generated::HandleUpdated", environmentVariables, props.DdApiKeySecret));
        handleProductUpdated.Function.AddEventSource(new SnsEventSource(props.ProductUpdatedTopic));
        
        var handleProductDeleted = new InstrumentedFunction(this, "HandleProductDeletedFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"HandleProductDeleted", "../src/Product.EventPublisher/ProductEventPublisher.Adapters/",
                "ProductEventPublisher.Adapters::ProductEventPublisher.Adapters.HandlerFunctions_HandleDeleted_Generated::HandleDeleted", environmentVariables, props.DdApiKeySecret));
        handleProductDeleted.Function.AddEventSource(new SnsEventSource(props.ProductCreatedTopic));

        props.EventBus.GrantPutEventsTo(handleProductCreated.Function);
        props.EventBus.GrantPutEventsTo(handleProductUpdated.Function);
        props.EventBus.GrantPutEventsTo(handleProductDeleted.Function);
    }
}