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
using Microsoft.Extensions.Logging;
using Orders.Core.PublicEvents;

namespace Orders.Core.Adapters;

public class EventBridgeEventPublisher(
    IConfiguration configuration,
    AmazonEventBridgeClient eventBridgeClient,
    ILogger<EventBridgeEventPublisher> logger) : IPublicEventPublisher
{
    private readonly string Source = $"{configuration["ENV"]}.orders";
    private readonly string EventBusName = configuration["EVENT_BUS_NAME"] ?? "";
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

        var cloudEvent = new CloudEvent(CloudEventsSpecVersion.V1_0);
        cloudEvent.Data = evtJsonData;
        cloudEvent.Id = Guid.NewGuid().ToString();
        cloudEvent.Source = new Uri($"http://{Source}");
        cloudEvent.Type = evt.DetailType;
        cloudEvent.Time = DateTimeOffset.UtcNow;
        cloudEvent.DataContentType = "application/json";
        if (Tracer.Instance.ActiveScope?.Span != null)
        {
            var serializedHeaders = "";

            try
            {
                Console.WriteLine("Injecting headers");
                var spanInjector = new SpanContextInjector();
                var headers = new Dictionary<string, string>();
            
                spanInjector.Inject("datadog", (s, s1, arg3) =>
                {
                    headers.Add(s1, arg3);
                }, Tracer.Instance.ActiveScope.Span.Context);

                serializedHeaders = JsonSerializer.Serialize(headers);
                Console.WriteLine(serializedHeaders);
            }
            catch (Exception e)
            {
                Console.WriteLine("Error manually injecting headers");
                Console.WriteLine(e);
            }
            
            cloudEvent.SetAttributeFromString("ddtraceid", Tracer.Instance.ActiveScope.Span.TraceId.ToString());
            cloudEvent.SetAttributeFromString("ddspanid", Tracer.Instance.ActiveScope.Span.SpanId.ToString());
            cloudEvent.SetAttributeFromString("tracedata", serializedHeaders);
        }

        var evtFormatter = new JsonEventFormatter();

        evt.Detail = evtFormatter.ConvertToJsonElement(cloudEvent).ToString();

        var putEventsResponse = await eventBridgeClient.PutEventsAsync(new PutEventsRequest()
        {
            Entries = new List<PutEventsRequestEntry>(1)
            {
                evt
            }
        });
        
        logger.LogInformation("Published {EventCount} events with {FailedEventCount} failures", putEventsResponse.Entries.Count, putEventsResponse.FailedEntryCount);
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