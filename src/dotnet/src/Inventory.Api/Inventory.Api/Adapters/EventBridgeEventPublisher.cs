// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using Inventory.Api.Core;

namespace Inventory.Api.Adapters;

public class EventBridgeEventPublisher(
    AmazonEventBridgeClient eventBridgeClient,
    ILogger<EventBridgeEventPublisher> logger) : EventPublisher
{
    private static readonly string Source = $"{Environment.GetEnvironmentVariable("ENV")}.inventory";
    private static readonly string EventBusName = Environment.GetEnvironmentVariable("EVENT_BUS_NAME") ?? "";

    public async Task Publish(InventoryStockUpdatedEvent evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = EventBusName,
            Source = Source,
            DetailType = "inventory.stockUpdated.v1",
            Detail = JsonSerializer.Serialize(evt)
        };

        await Publish(putEventRecord);
    }

    private async Task Publish(PutEventsRequestEntry evt)
    {
        var evtJsonData = JsonNode.Parse(evt.Detail);

        if (evtJsonData is null)
        {
            logger.LogWarning("Invalid JObject to be published");
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