// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.Annotations.APIGateway;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;

namespace TestHarness.Lambda;

public class ApiFunctions(IEventStore eventStore)
{
    [LambdaFunction]
    [RestApi(LambdaHttpMethod.Get, "/events/{eventId}")]
    public async Task<IHttpResult> GetReceivedEvents(string eventId)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            var events = await eventStore.EventsFor(eventId);
            
            return HttpResults.Ok(JsonSerializer.Serialize(events));
        }
        catch (Exception ex)
        {
            activeSpan?.SetException(ex);
            Logger.LogError(ex, "Failure retrieving product");
            return HttpResults.NotFound();
        }
    }
}