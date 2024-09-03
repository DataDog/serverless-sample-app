using System.Text.Json;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using ProductEventPublisher.Core;
using ProductEventPublisher.Core.ExternalEvents;

namespace ProductEventPublisher.Adapters;

public class EventBridgeExternalEventPublisher(AmazonEventBridgeClient eventBridgeClient) : IExternalEventPublisher
{
    private static string _source = $"{System.Environment.GetEnvironmentVariable("ENV")}.products";
    private static string _eventBusName = $"{System.Environment.GetEnvironmentVariable("EVENT_BUS_NAME")}.products";
    private readonly AmazonEventBridgeClient _eventBridgeClient = eventBridgeClient;

    public async Task Publish(ProductCreatedEventV1 evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = _eventBusName,
            Source = _source,
            DetailType = "product.productCreated.v1",
            Detail = JsonSerializer.Serialize(evt)
        };
        
        await this.Publish(putEventRecord);
    }

    public async Task Publish(ProductUpdatedEventV1 evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = _eventBusName,
            Source = _source,
            DetailType = "product.productUpdated.v1",
            Detail = JsonSerializer.Serialize(evt)
        };
        
        await this.Publish(putEventRecord);
    }

    public async Task Publish(ProductDeletedEventV1 evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = _eventBusName,
            Source = _source,
            DetailType = "product.productDeleted.v1",
            Detail = JsonSerializer.Serialize(evt)
        };
        
        await this.Publish(putEventRecord);
    }

    private async Task Publish(PutEventsRequestEntry evt)
    {
        evt.AddToTelemetry();

        await this._eventBridgeClient.PutEventsAsync(new PutEventsRequest()
        {
            Entries = new List<PutEventsRequestEntry>(1)
            {
                evt
            }
        });
    }
}