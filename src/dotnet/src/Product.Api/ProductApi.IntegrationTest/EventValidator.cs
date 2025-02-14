// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text;
using System.Text.Json;
using NJsonSchema;
using Shouldly;

namespace ProductApi.IntegrationTest;

public class EventValidator
{
    private HttpClient _client = new();
    
    public async Task Validate(string key, int expectedEventCount, string expectedReceivedFrom, string? schemaToValidate = null)
    {
        var retrievedEvents = await _client.GetAsync($"https://lrcwc7jqh3.execute-api.eu-west-1.amazonaws.com/prod/events/{key}");
        var eventBody = await retrievedEvents.Content.ReadAsStringAsync();
        var events = JsonSerializer.Deserialize<List<ReceivedEvent>>(eventBody);
        
        var maxRetries = 3;
        
        while (events.Count < expectedEventCount && maxRetries > 0)
        {
            await Task.Delay(1000);
            retrievedEvents = await _client.GetAsync($"https://lrcwc7jqh3.execute-api.eu-west-1.amazonaws.com/prod/events/{key}");
            eventBody = await retrievedEvents.Content.ReadAsStringAsync();
            events = JsonSerializer.Deserialize<List<ReceivedEvent>>(eventBody);
            maxRetries--;
        }

        var matchedEvent = events.FirstOrDefault(evt => evt.ReceivedFrom.Contains(expectedReceivedFrom));
        Assert.NotNull(matchedEvent);
        
        if (schemaToValidate == null) return;
        
        var expectedSchema =
            await JsonSchema.FromJsonAsync(await File.ReadAllTextAsync(schemaToValidate));
        var schemaValidationResult = expectedSchema.Validate(matchedEvent.EventData);
        var validationResultString = new StringBuilder();
        foreach (var error in schemaValidationResult)
        {
            validationResultString.AppendLine(error.ToString());
        }
        schemaValidationResult.Count.ShouldBe(0, validationResultString.ToString());
    }
}