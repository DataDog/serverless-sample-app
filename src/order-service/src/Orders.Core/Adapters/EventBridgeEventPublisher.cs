// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using CloudNative.CloudEvents;
using CloudNative.CloudEvents.SystemTextJson;
using Datadog.Trace;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Orders.Core.PublicEvents;

namespace Orders.Core.Adapters;

internal record DeprecationInfo(DateTime Date, string SupercededBy);

public class EventBridgeEventPublisher(
    ILogger<EventBridgeEventPublisher> logger,
    IConfiguration configuration,
    AmazonEventBridgeClient eventBridgeClient) : IPublicEventPublisher
{
    private readonly string Source = $"{configuration["ENV"]}.orders";
    private readonly string EventBusName = configuration["EVENT_BUS_NAME"] ?? "";

    private async Task Publish(PutEventsRequestEntry evt, DeprecationInfo? deprecationInfo = null)
    {
        using var scope = Tracer.Instance.StartActive($"publish {evt.DetailType}");

        var cloudEvent = evt.GenerateCloudEventFrom();
        var evtFormatter = new JsonEventFormatter();

        // Set deprecation info if applicable
        if (deprecationInfo != null)
        {
            logger.LogWarning("Publishing deprecated event {EventDetailType} which will be superceded by {SupercededBy} on {DeprecationDate}",
                evt.DetailType,
                deprecationInfo.SupercededBy,
                deprecationInfo.Date.ToString("o", CultureInfo.InvariantCulture));
            scope.Span.SetTag("event.deprecated", "true");
            
            cloudEvent?.SetAttributeFromString("supercededby", deprecationInfo.SupercededBy);
            cloudEvent?.SetAttributeFromString("deprecationdate",
                deprecationInfo.Date.ToString("o", CultureInfo.InvariantCulture));
        }
        
        if (cloudEvent != null)
        {
            evt.Detail = evtFormatter.ConvertToJsonElement(cloudEvent).ToString();
            scope.Span.AddSemConvFrom(evt, cloudEvent);
        }

        var detailNode = JsonNode.Parse(evt.Detail) ?? new JsonObject();

        new SpanContextInjector().InjectIncludingDsm(
            detailNode,
            SetHeader,
            scope.Span.Context,
            "sns",
            evt.DetailType);

        evt.Detail = detailNode.ToJsonString();

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

        await Publish(putEventRecord, new DeprecationInfo(new DateTime(2025, 12, 01), "orders.orderCompleted.v2"));
    }

    public async Task Publish(OrderCompletedEventV2 evt)
    {
        var putEventRecord = new PutEventsRequestEntry
        {
            EventBusName = EventBusName,
            Source = Source,
            DetailType = "orders.orderCompleted.v2",
            Detail = JsonSerializer.Serialize(evt)
        };

        await Publish(putEventRecord);
    }

    private static void SetHeader(JsonNode carrier, string key, string value)
    {
        if (carrier["_datadog"] == null) carrier["_datadog"] = new JsonObject();

        carrier["_datadog"]![key] = value;
    }
}