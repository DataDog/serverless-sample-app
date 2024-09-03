using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.Events.Targets;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SecretsManager;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Analytics;

public record AnalyticsServiceProps(SharedProps Shared, ISecret DdApiKeySecret, IEventBus SharedEventBus);

public class AnalyticsService : Construct
{
    public AnalyticsService(Construct scope, string id, AnalyticsServiceProps props) : base(scope, id)
    {
        var analyticsQueue = new ResilientQueue(this, "AnalyticsQueue",
            new ResilientQueueProps($"{props.Shared.ServiceName}-Events", props.Shared.Env));
        
        var analyticsHandlerFunction = new InstrumentedFunction(this, "AnalyticsHandlerFunction",
            new FunctionProps(props.Shared,"AnalyticsHandlerFunction", "../src/Analytics/Analytics.Adapters/",
                "Analytics.Adapters::Analytics.Adapters.HandlerFunctions_HandleEvents_Generated::HandleEvents", new Dictionary<string, string>(), props.DdApiKeySecret));
        analyticsHandlerFunction.Function.AddEventSource(new SqsEventSource(analyticsQueue.Queue, new SqsEventSourceProps()
        {
            ReportBatchItemFailures = true,
            BatchSize = 10,
            MaxBatchingWindow = Duration.Seconds(10)
        }));

        var eventCatchAllRule = new Rule(this, "AnalyticsEventCatchAllRule", new RuleProps()
        {
            EventBus = props.SharedEventBus,
        });
        eventCatchAllRule.AddEventPattern(new EventPattern()
        {
            Source = Match.Prefix(props.Shared.Env)
        });
        eventCatchAllRule.AddTarget(new SqsQueue(analyticsQueue.Queue));
    }
}