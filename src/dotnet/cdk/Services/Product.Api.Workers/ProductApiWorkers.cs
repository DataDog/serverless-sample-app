using System.Collections.Generic;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.Api.Workers;

public record ProductApiWorkersProps(string ServiceName, string Env, string Version, ISecret DdApiKeySecret, ITable ProductTable, ITopic PricingUpdatedTopic);

public class ProductApiWorkers : Construct
{
    public ProductApiWorkers(Construct scope, string id, ProductApiWorkersProps props) : base(scope, id)
    {
        var apiEnvironmentVariables = new Dictionary<string, string>(2)
        {
            { "TABLE_NAME", props.ProductTable.TableName },
        };
        
        var handlePricingUpdated = new InstrumentedFunction(this, "HandlePricingUpdatedFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"HandlePricingUpdated", "../src/Product.Api/ProductApi.Adapters/",
                "ProductApi.Adapters::ProductApi.Adapters.HandlerFunctions_HandlePricingUpdated_Generated::HandlePricingUpdated", apiEnvironmentVariables, props.DdApiKeySecret));
        handlePricingUpdated.Function.AddEventSource(new SnsEventSource(props.PricingUpdatedTopic));

        props.ProductTable.GrantReadData(handlePricingUpdated.Function);
        props.ProductTable.GrantWriteData(handlePricingUpdated.Function);
    }
}