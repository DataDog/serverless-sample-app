using Amazon.CDK;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.Events.Targets;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS.Subscriptions;
using Constructs;
using EventBus = Amazon.CDK.AWS.Events.EventBus;

namespace DotnetLambdaHybridTracing;

public class DotnetLambdaHybridTracingStack : Stack
{
    internal DotnetLambdaHybridTracingStack(Construct scope, string id, IStackProps props = null) : base(scope, id,
        props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_SECRET_ARN"));

        var serviceName = "DotnetHybridTracing";
        var env = "dotnet-trace-test";
        var version = "latest";

        var bus = new EventBus(this, "TracedDotnetBus");

        var api = new Api(this, "TracedApi", new ApiProps(serviceName, env, version, secret));
        var backgroundWorkers = new BackgroundWorker(this, "TracedSnsWorker", new BackgroundWorkerProps(serviceName, env, version, secret, bus));
        
        api.Topic.AddSubscription(new SqsSubscription(backgroundWorkers.SnsConsumerQueue));
        backgroundWorkers.SnsConsumerFunction.AddEventSource(new SnsEventSource(api.Topic));

        var rule = new Rule(this, "OrderCreatedEventRule", new RuleProps()
        {
            EventBus = bus
        });
        rule.AddEventPattern(new EventPattern()
        {
            Source = [$"{env}.orders"],
            DetailType = ["order.orderCreated"]
        });
        rule.AddTarget(new SqsQueue(backgroundWorkers.EventBridgeConsumerQueue));
        rule.AddTarget(new LambdaFunction(backgroundWorkers.EventBridgeConsumerFunction));
    }
}