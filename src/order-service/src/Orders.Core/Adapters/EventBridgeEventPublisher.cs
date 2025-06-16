// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using CloudNative.CloudEvents;
using CloudNative.CloudEvents.SystemTextJson;
using Datadog.Trace;
using Microsoft.Extensions.Configuration;
using Orders.Core.PublicEvents;
using Serilog;

namespace Orders.Core.Adapters;

public class EventBridgeEventPublisher(
    IConfiguration configuration,
    AmazonEventBridgeClient eventBridgeClient) : IPublicEventPublisher
{
    private readonly string Source = $"{configuration["ENV"]}.orders";
    private readonly string EventBusName = configuration["EVENT_BUS_NAME"] ?? "";

    private async Task Publish(PutEventsRequestEntry evt)
    {
        using var scope = Tracer.Instance.StartActive($"publish {evt.DetailType}");

        var cloudEvent = evt.GenerateCloudEventFrom();
        var evtFormatter = new JsonEventFormatter();
        if (cloudEvent != null)
        {
            evt.Detail = evtFormatter.ConvertToJsonElement(cloudEvent).ToString();
            scope.Span.AddSemConvFrom(evt, cloudEvent);
        }
        
        new SpanContextInjector().InjectIncludingDsm(
            evt.Detail,
            SetHeader,
            scope.Span.Context,
            "sns",
            evt.DetailType);

        var putEventsResponse = await eventBridgeClient.PutEventsAsync(new PutEventsRequest
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
        var putEventRecord = new PutEventsRequestEntry
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
        var putEventRecord = new PutEventsRequestEntry
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
        var putEventRecord = new PutEventsRequestEntry
        {
            EventBusName = EventBusName,
            Source = Source,
            DetailType = "orders.orderCompleted.v1",
            Detail = JsonSerializer.Serialize(evt)
        };

        await Publish(putEventRecord);
    }

    private static void SetHeader(string eventJson, string key, string value)
    {
        Log.Logger.Information("Setting header {Key} with value {Value}", key, value);
        
        var jsonNode = JsonNode.Parse(eventJson);
        if (jsonNode?["_datadog"] == null)
        {
            jsonNode!["_datadog"] = new JsonObject();
        }
        
        jsonNode!["_datadog"]![key] = value;
        
        Log.Logger.Information("State of Datadog node is {DatadogNode}", jsonNode!["_datadog"]);
    }
}