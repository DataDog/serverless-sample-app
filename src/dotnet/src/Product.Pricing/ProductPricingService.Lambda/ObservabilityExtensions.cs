using System.Text;
using System.Text.Json.Nodes;
using Amazon.Lambda.SNSEvents;
using Amazon.SimpleNotificationService.Model;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;
using NJsonSchema;
using StatsdClient;

namespace ProductPricingService.Lambda;

public static class ObservabilityExtensions
{
    public static void AddToTelemetry(this SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        activeSpan?.SetTag("messaging.operation.type", "receive");
        activeSpan?.SetTag("messaging.system", "aws_sns");
        activeSpan?.SetTag("messaging.batch.message_count", evt.Records.Count);
    }
    
    public static void AddToTelemetry(this SNSEvent.SNSRecord record)
    {
        var schema = JsonSchema.FromSampleJson(record.Sns.Message);
        Logger.LogInformation(schema.ToJson());
        
        var processingSpan = Tracer.Instance.ActiveScope?.Span;
        processingSpan?.SetTag("messaging.message.body.size",
            Encoding.UTF8.GetByteCount(record.Sns.Message));
        processingSpan?.SetTag("messaging.message.schema", schema.ToJson());
    }
    
    public static void AddToTelemetry(this PublishRequest publishRequest)
    {
        var destinationName = ExtractNameFromArn(publishRequest.TopicArn);
        
        var schema = JsonSchema.FromSampleJson(publishRequest.Message);
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        Logger.LogInformation(schema.ToJson());
        activeSpan?.SetTag("messaging.message.schema", schema.ToJson());
        activeSpan?.SetTag("messaging.message.type", destinationName);
        activeSpan?.SetTag("messaging.destination.name", destinationName);
        
        DogStatsd.Increment("messaging.client.published.messages", 1, 1D,
            new[]
            {
                "messaging.operation.name:send",
                "messaging.system:aws_sns",
                $"messaging.destination.name:{destinationName}",
                $"messaging.message.type:{destinationName}"
            });
        DogStatsd.Distribution("messaging.client.published.message.bytes", Encoding.UTF8.GetByteCount(publishRequest.Message), 1D,
            new[]
            {
                "messaging.operation.name:receive",
                "messaging.system:aws_sns",
                $"messaging.destination.name:{destinationName}",
                $"messaging.message.type:{destinationName}"
            });
    }

    public static IDisposable StartProcessingTimer(this SNSEvent.SNSRecord record)
    {
        try
        {
            var messageBody = JsonNode.Parse(record.Sns.Message);
        
            if (messageBody is not null && messageBody["PublishDateTime"] is not null)
            {
                var publishedDate = DateTime.Parse(messageBody["PublishDateTime"]!.ToString());

                var inFlightTime = (DateTime.Now - publishedDate).TotalMilliseconds;
                DogStatsd.Timer("messaging.inflight.duration", inFlightTime, 1D,
                    new[]
                    {
                        "messaging.system:aws_sns",
                        $"messaging.destination.name:{ExtractNameFromArn(record.Sns.TopicArn)}",
                        $"messaging.destination.subscription.name:{record.EventSubscriptionArn}"
                    });
            }
        }
        catch (Exception e)
        {
            Logger.LogWarning(e, "Failure calculating inflight duration");
        }
        
        var timer = DogStatsd.StartTimer("messaging.process.duration", 1D,
            new[]
            {
                "messaging.operation.name:process",
                "messaging.system:aws_sns",
                $"messaging.destination.name:{ExtractNameFromArn(record.Sns.TopicArn)}",
                $"messaging.destination.subscription.name:{record.EventSubscriptionArn}"
            });

        return timer;
    }
    
    public static void AddProcessingMetrics(this SNSEvent.SNSRecord record, Exception? ex = null)
    {
        if (ex is not null)
        {
            Logger.LogError(ex, "Failure processing message");
        }
        var topicName = ExtractNameFromArn(record.Sns.TopicArn);
        var subscriptionName = ExtractNameFromArn(record.EventSubscriptionArn);

        DogStatsd.Increment("messaging.client.consumed.messages", 1, 1D,
            new[]
            {
                "messaging.operation.name:receive",
                "messaging.system:aws_sns",
                $"messaging.destination.name:{topicName}",
                $"messaging.destination.subscription.name:{subscriptionName}",
                ex is null ? "" : $"error.type:{ex.GetType().Name}"
            });
        DogStatsd.Distribution("messaging.client.consumed.message.bytes",
            Encoding.UTF8.GetByteCount(record.Sns.Message), 1D,
            new[]
            {
                "messaging.operation.name:receive",
                "messaging.system:aws_sns",
                $"messaging.destination.name:{topicName}",
                $"messaging.destination.subscription.name:{subscriptionName}",
                ex is null ? "" : $"error.type:{ex.GetType().Name}"
            });
    }
    
    private static string ExtractNameFromArn(string topicArn)
    {
        return topicArn.Split(':')[5];
    }
}