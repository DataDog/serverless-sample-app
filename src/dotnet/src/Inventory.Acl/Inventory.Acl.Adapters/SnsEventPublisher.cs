using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.SimpleNotificationService;
using Amazon.SimpleNotificationService.Model;
using AWS.Lambda.Powertools.Logging;
using Inventory.Acl.Core;
using Inventory.Acl.Core.InternalEvents;
using Microsoft.Extensions.Configuration;

namespace Inventory.Acl.Adapters;

public class SnsEventPublisher(AmazonSimpleNotificationServiceClient snsClient, IConfiguration configuration) : IInternalEventPublisher
{
    public async Task Publish(NewProductAddedEvent evt)
    {
        var publishRequest = new PublishRequest(configuration["PRODUCT_ADDED_TOPIC_ARN"],
            JsonSerializer.Serialize(evt));
        
        var evtJsonData = JsonNode.Parse(publishRequest.Message);

        if (evtJsonData is null)
        {
            Logger.LogWarning("Invalid JObject to be published");
            return;
        }
        
        evtJsonData["PublishDateTime"] = DateTime.Now.ToString("s");
        evtJsonData["EventId"] = Guid.NewGuid().ToString();
        publishRequest.Message = evtJsonData.ToJsonString();
        
        publishRequest.AddToTelemetry();

        await snsClient.PublishAsync(publishRequest);
    }
}