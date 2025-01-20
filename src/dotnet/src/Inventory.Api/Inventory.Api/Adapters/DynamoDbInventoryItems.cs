// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Inventory.Api.Core;

namespace Inventory.Api.Adapters;

public class DynamoDbInventoryItems(AmazonDynamoDBClient dynamoDbClient, ILogger<DynamoDbInventoryItems> logger)
    : InventoryItems
{
    public async Task<InventoryItem?> WithProductId(string productId)
    {
        logger.LogInformation("Retrieving InventoryItem with productId {productId} from DynamoDB", productId);

        var getItemResult = await dynamoDbClient.GetItemAsync(Environment.GetEnvironmentVariable("TABLE_NAME"),
            new Dictionary<string, AttributeValue>()
            {
                { "PK", new AttributeValue(productId) }
            });

        if (!getItemResult.IsItemSet) return null;

        return new InventoryItem()
        {
            ProductId = getItemResult.Item["productId"].S,
            CurrentStockLevel = int.Parse(getItemResult.Item["stockLevel"].N)
        };
    }

    public async Task Update(InventoryItem item)
    {
        logger.LogInformation("Updating InventoryItem with productID {productId} with stock level {stockLevel}",
            item.ProductId, item.CurrentStockLevel);

        await dynamoDbClient.PutItemAsync(Environment.GetEnvironmentVariable("TABLE_NAME"),
            new Dictionary<string, AttributeValue>()
            {
                { "PK", new AttributeValue(item.ProductId) },
                { "productId", new AttributeValue(item.ProductId) },
                {
                    "stockLevel", new AttributeValue()
                    {
                        N = item.CurrentStockLevel.ToString()
                    }
                },
                { "Type", new AttributeValue("InventoryItem") }
            });
    }
}