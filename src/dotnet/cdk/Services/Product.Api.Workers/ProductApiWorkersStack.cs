using Amazon.CDK;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.Api.Workers;

public class ProductApiWorkersStack : Stack {
    
    internal ProductApiWorkersStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_SECRET_ARN"));

        var serviceName = "DotnetProductApiWorkers";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version);
        
        var pricingUpdatedTopicParameter = StringParameter.FromStringParameterName(this, "PricingUpdatedTopicArn",
            "/dotnet/product-pricing/pricing-updated-topic");
        var pricingUpdatedTopic = Topic.FromTopicArn(this, "PricingUpdatedTopic", pricingUpdatedTopicParameter.StringValue);

        var productsTableParameter =
            StringParameter.FromStringParameterName(this, "ProductsTableArnParam", "/dotnet/product-api/table-arn");
        var productTable = Table.FromTableArn(this, "ProductTable", productsTableParameter.StringValue);

        var productApiWorkers = new ProductApiWorkers(this, "DotnetProductApiWorkers", new ProductApiWorkersProps(sharedProps, secret, productTable, pricingUpdatedTopic));
    }
}