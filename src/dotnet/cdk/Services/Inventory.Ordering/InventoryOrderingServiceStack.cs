using Amazon.CDK;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Inventory.Ordering;

public class InventoryOrderingServiceStack : Stack
{
    internal InventoryOrderingServiceStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_SECRET_ARN"));

        var serviceName = "DotnetInventoryOrderingService";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version);

        var newProductAddedTopicParam = StringParameter.FromStringParameterName(this, "ProductCreatedTopicArn",
            "/dotnet/inventory-acl/new-product-added-topic");
        var newProductAddedTopic = Topic.FromTopicArn(this, "ProductCreatedTopic", newProductAddedTopicParam.StringValue);

        var api = new InventoryOrderingService(this, "DotnetInventoryOrderingService", new InventoryOrderingServiceProps(sharedProps, secret, newProductAddedTopic));
    }
}