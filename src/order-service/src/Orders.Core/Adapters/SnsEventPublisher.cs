// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.SimpleNotificationService;
using Amazon.SimpleNotificationService.Model;
using Datadog.Trace;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Orders.Core.InternalEvents;

namespace Orders.Core.Adapters;

public class SnsEventPublisher(AmazonSimpleNotificationServiceClient snsClient, ILogger<SnsEventPublisher> logger, IConfiguration configuration)
: IEventPublisher
{
    private readonly JsonSerializerOptions _options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task Publish(OrderCreatedEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        var publishSpan = Tracer.Instance.StartActive("publish", new SpanCreationSettings()
        {
            Parent = activeSpan?.Context
        });

        var req = new PublishRequest()
        {
            Message = JsonSerializer.Serialize(evt),
            TopicArn = configuration["ORDER_CREATED_TOPIC_ARN"]
        };
        
        var evtJsonData = JsonNode.Parse(req.Message);

        if (evtJsonData is null)
        {
            logger.LogWarning("Invalid JObject to be published");
            return;
        }
        
        evtJsonData["PublishDateTime"] = DateTime.Now.ToString("s");
        evtJsonData["EventId"] = Guid.NewGuid().ToString();
        req.Message = evtJsonData.ToJsonString();
        
        await snsClient.PublishAsync(req);
        
        publishSpan.Close();
    }
}