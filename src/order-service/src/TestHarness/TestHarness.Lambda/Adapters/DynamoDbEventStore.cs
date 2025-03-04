// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Globalization;
using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using AWS.Lambda.Powertools.Logging;
using Microsoft.Extensions.Configuration;

namespace TestHarness.Lambda.Adapters;

public class DynamoDbEventStore(
    AmazonDynamoDBClient dynamoDbClient,
    IConfiguration configuration)
    : IEventStore
{
    private const string PartitionKeyItemKey = "PK";
    private const string SortKey = "SK";
    private const string EventDataKey = "EventData";
    private const string ReceivedFromKey = "ReceivedFrom";
    private const string DateTimeKey = "DateTime";
    private const string ConversationId = "ConversationId";

    public async Task Store(ReceivedEvent evt)
    {
        Logger.LogInformation("Storing event {Key} from {ReceivedFrom} with type {EventType}", evt.Key, evt.ReceivedFrom, evt.EventType);
        
        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(4)
        {
            { PartitionKeyItemKey, new AttributeValue(evt.Key) },
            { SortKey, new AttributeValue($"{evt.ReceivedOn.ToString("yyyyMMddhhmmss")}_{evt.EventType}") },
            { EventDataKey, new AttributeValue(evt.EventData) },
            { DateTimeKey, new AttributeValue(evt.ReceivedOn.ToString("yyyyMMddhhmmss")) },
            { ReceivedFromKey, new AttributeValue(evt.ReceivedFrom) },
            { ConversationId, new AttributeValue(evt.ConversationId) }
        });
    }

    public async Task<List<ReceivedEvent>> EventsFor(string key)
    {
        var evtsResult = await dynamoDbClient.QueryAsync(new QueryRequest(configuration["TABLE_NAME"])
        {
            KeyConditionExpression = "PK = :v_PK",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>(1)
            {
                { ":v_PK", new AttributeValue(key) }
            }
        });

        var evts = new List<ReceivedEvent>();

        foreach (var eventItem in evtsResult.Items)
            evts.Add(new ReceivedEvent(eventItem[PartitionKeyItemKey].S,
                eventItem[EventDataKey].S,
                eventItem[SortKey].S.Split("_")[1],
                DateTime.ParseExact(eventItem[DateTimeKey].S, "yyyyMMddhhmmss", CultureInfo.InvariantCulture),
                eventItem[ReceivedFromKey].S,
                eventItem[ConversationId].S));

        return evts;
    }
}