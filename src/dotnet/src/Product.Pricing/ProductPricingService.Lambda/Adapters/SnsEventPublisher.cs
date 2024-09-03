using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.SimpleNotificationService;
using Amazon.SimpleNotificationService.Model;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;
using Microsoft.Extensions.Configuration;
using ProductPricingService.Core;

namespace ProductPricingService.Lambda.Adapters;

public class SnsEventPublisher(AmazonSimpleNotificationServiceClient snsClient, IConfiguration configuration)
    : IEventPublisher
{
    private readonly JsonSerializerOptions _options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task Publish(ProductPricingUpdatedEvent evt)
    {
        var publishRequest = new PublishRequest(configuration["PRICE_CALCULATED_TOPIC_ARN"], JsonSerializer.Serialize(evt, _options));
        await this.Publish(publishRequest);
    }

    private async Task Publish(PublishRequest req)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        var publishSpan = Tracer.Instance.StartActive("publish", new SpanCreationSettings()
        {
            Parent = activeSpan?.Context
        });
        
        var evtJsonData = JsonNode.Parse(req.Message);

        if (evtJsonData is null)
        {
            Logger.LogWarning("Invalid JObject to be published");
            return;
        }
        
        evtJsonData["PublishDateTime"] = DateTime.Now.ToString("s");
        evtJsonData["EventId"] = Guid.NewGuid().ToString();
        req.Message = evtJsonData.ToJsonString();
        
        req.AddToTelemetry();        
        await snsClient.PublishAsync(req);
        
        publishSpan.Close();
    }
}