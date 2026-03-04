// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.EventBridge.Model;
using CloudNative.CloudEvents;
using CloudNative.CloudEvents.SystemTextJson;
using Datadog.Trace;

namespace Orders.Core.Adapters;

public static class MessagingExtensions
{
    public static CloudEvent? GenerateCloudEventFrom(this PutEventsRequestEntry evt)
    {
        var evtJsonData = JsonNode.Parse(evt.Detail);

        if (evtJsonData is null)
        {
            return null;
        }

        var cloudEvent = new CloudEvent(CloudEventsSpecVersion.V1_0);
        cloudEvent.Data = evtJsonData;
        cloudEvent.Id = Guid.NewGuid().ToString();
        cloudEvent.Source = new Uri($"http://{evt.Source}");
        cloudEvent.Type = evt.DetailType;
        cloudEvent.Time = DateTimeOffset.UtcNow;
        cloudEvent.DataContentType = "application/json";
        cloudEvent.SetAttributeFromString("publishdatetime", DateTime.UtcNow.ToString("s"));
        cloudEvent.SetAttributeFromString("eventid", Guid.NewGuid().ToString());
        if (Tracer.Instance.ActiveScope?.Span != null)
        {
            cloudEvent.SetAttributeFromString("traceparent", $"00-{Tracer.Instance.ActiveScope.Span.TraceId:x32}-{Tracer.Instance.ActiveScope.Span.SpanId:x16}-01");
        }

        return cloudEvent;
    }

    public static void AddSemConvFrom(this ISpan span, PutEventsRequestEntry ebEvt, CloudEvent evt)
    {
        span.SetTag("domain", Environment.GetEnvironmentVariable("DOMAIN"));
        span.SetTag("messaging.message.eventType", "public");
        span.SetTag("messaging.message.type", evt.Type);
        span.SetTag("messaging.message.domain", Environment.GetEnvironmentVariable("DOMAIN"));
        span.SetTag("messaging.message.id", evt.Id);
        span.SetTag("messaging.operation.type", "publish");
        span.SetTag("messaging.system", "eventbridge");
        span.SetTag("messaging.batch.message_count", 1);
        span.SetTag("messaging.destination.name", ebEvt.EventBusName);
        span.SetTag("messaging.client.id", Environment.GetEnvironmentVariable("DD_SERVICE") ?? "");
        span.SetTag("messaging.message.body.size", Encoding.UTF8.GetBytes(JsonSerializer.Serialize(evt.Data)).Length);
        span.SetTag("messaging.operation.name", "send");
    }
}