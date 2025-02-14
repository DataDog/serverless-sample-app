// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Globalization;
using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Microsoft.Extensions.Configuration;

namespace TestHarness.Lambda.Adapters;

public class DynamoDbEventStore(
    AmazonDynamoDBClient dynamoDbClient,
    IConfiguration configuration)
    : IEventStore
{
    private const string PartitionKeyItemKey = "PK";
    private const string EventDataKey = "EventData";
    private const string ReceivedFromKey = "ReceivedFrom";
    private const string DateTimeKey = "DateTime";

    public async Task Store(ReceivedEvent evt)
    {
        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(4)
        {
            { PartitionKeyItemKey, new AttributeValue(evt.Key) },
            { EventDataKey, new AttributeValue(evt.EventData) },
            { DateTimeKey, new AttributeValue(evt.ReceivedOn.ToString("yyyyMMddhhmmss")) },
            { ReceivedFromKey, new AttributeValue(evt.ReceivedFrom) }
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
                DateTime.ParseExact(eventItem[DateTimeKey].S, "yyyyMMddhhmmss", CultureInfo.InvariantCulture),
                eventItem[ReceivedFromKey].S));

        return evts;
    }
}