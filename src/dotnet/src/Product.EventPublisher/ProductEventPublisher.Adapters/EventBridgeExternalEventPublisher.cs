using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using AWS.Lambda.Powertools.Logging;
using ProductEventPublisher.Core;
using ProductEventPublisher.Core.ExternalEvents;

namespace ProductEventPublisher.Adapters;

public class EventBridgeExternalEventPublisher(AmazonEventBridgeClient eventBridgeClient) : IExternalEventPublisher
{
    private static readonly string Source = $"{Environment.GetEnvironmentVariable("ENV")}.products";
    private static readonly string EventBusName = Environment.GetEnvironmentVariable("EVENT_BUS_NAME") ?? "";

    public async Task Publish(ProductCreatedEventV1 evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = EventBusName,
            Source = Source,
            DetailType = "product.productCreated.v1",
            Detail = JsonSerializer.Serialize(evt)
        };
        
        await this.Publish(putEventRecord);
    }

    public async Task Publish(ProductUpdatedEventV1 evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = EventBusName,
            Source = Source,
            DetailType = "product.productUpdated.v1",
            Detail = JsonSerializer.Serialize(evt)
        };
        
        await this.Publish(putEventRecord);
    }

    public async Task Publish(ProductDeletedEventV1 evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = EventBusName,
            Source = Source,
            DetailType = "product.productDeleted.v1",
            Detail = JsonSerializer.Serialize(evt)
        };
        
        await this.Publish(putEventRecord);
    }

    private async Task Publish(PutEventsRequestEntry evt)
    {
        var evtJsonData = JsonNode.Parse(evt.Detail);

        if (evtJsonData is null)
        {
            Logger.LogWarning("Invalid JObject to be published");
            return;
        }
        
        evtJsonData["PublishDateTime"] = DateTime.Now.ToString("s");
        evtJsonData["EventId"] = Guid.NewGuid().ToString();
        evt.Detail = evtJsonData.ToJsonString();
        
        evt.AddToTelemetry();

        await eventBridgeClient.PutEventsAsync(new PutEventsRequest()
        {
            Entries = new List<PutEventsRequestEntry>(1)
            {
                evt
            }
        });
    }
}