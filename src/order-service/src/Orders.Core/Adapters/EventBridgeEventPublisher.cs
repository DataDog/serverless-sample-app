// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using CloudNative.CloudEvents.SystemTextJson;
using Datadog.Trace;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Orders.Core.PublicEvents;

namespace Orders.Core.Adapters;

public class EventBridgeEventPublisher(
    IConfiguration configuration,
    AmazonEventBridgeClient eventBridgeClient) : IPublicEventPublisher
{
    private readonly string Source = $"{configuration["ENV"]}.orders";
    private readonly string EventBusName = configuration["EVENT_BUS_NAME"] ?? "";

    private async Task Publish(PutEventsRequestEntry evt)
    {
        var scope = Tracer.Instance.StartActive($"publish {evt.DetailType}");
        
        var cloudEvent = evt.GenerateCloudEventFrom();
        var evtFormatter = new JsonEventFormatter();
        if (cloudEvent != null)
        {
            evt.Detail = evtFormatter.ConvertToJsonElement(cloudEvent).ToString();
            scope.Span.AddSemConvFrom(evt, cloudEvent);
        }

        var putEventsResponse = await eventBridgeClient.PutEventsAsync(new PutEventsRequest()
        {
            Entries = new List<PutEventsRequestEntry>(1)
            {
                evt
            }
        });

        scope.Span.SetTag("messaging.failedMessageCount", putEventsResponse.FailedEntryCount);
        scope.Span.SetTag("messaging.publishStatusCode", putEventsResponse.HttpStatusCode.ToString());
    }

    public async Task Publish(OrderCreatedEventV1 evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = EventBusName,
            Source = Source,
            DetailType = "orders.orderCreated.v1",
            Detail = JsonSerializer.Serialize(evt)
        };

        await Publish(putEventRecord);
    }

    public async Task Publish(OrderConfirmedEventV1 evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = EventBusName,
            Source = Source,
            DetailType = "orders.orderConfirmed.v1",
            Detail = JsonSerializer.Serialize(evt)
        };

        await Publish(putEventRecord);
    }

    public async Task Publish(OrderCompletedEventV1 evt)
    {
        var putEventRecord = new PutEventsRequestEntry()
        {
            EventBusName = EventBusName,
            Source = Source,
            DetailType = "orders.orderCompleted.v1",
            Detail = JsonSerializer.Serialize(evt)
        };

        await Publish(putEventRecord);
    }
}