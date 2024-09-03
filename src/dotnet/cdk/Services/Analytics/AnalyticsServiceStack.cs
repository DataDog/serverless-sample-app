using Amazon.CDK;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SSM;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Analytics;

public class AnalyticsServiceStack : Stack
{
    internal AnalyticsServiceStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_SECRET_ARN"));

        var serviceName = "DotnetAnalyticsService";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version);

        var eventBusTopicArn =StringParameter.FromStringParameterName(this, "EventBusTopicArn",
            "/dotnet/shared/event-bus-name");
        var eventBus = EventBus.FromEventBusName(this, "SharedEventBus", eventBusTopicArn.StringValue);

        var analyticsService = new AnalyticsService(this, "DotnetAnalyticsService", new AnalyticsServiceProps(sharedProps, secret, eventBus));
    }
}