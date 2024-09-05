// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Microsoft.Extensions.Configuration;
using ProductApi.Core;

namespace ProductApi.Adapters.Adapters;

public class DynamoDbProducts(
    AmazonDynamoDBClient dynamoDbClient,
    IConfiguration configuration)
    : IProducts
{
    private const string PartitionKeyItemKey = "PK";
    private const string NameItemKey = "Name";
    private const string PriceItemKey = "Price";
    private const string PriceBracketsItemKey = "PriceBrackets";
    public async Task<Product?> WithId(string productId)
    {
        var product = await dynamoDbClient.GetItemAsync(configuration["TABLE_NAME"],
            new Dictionary<string, AttributeValue>()
            {
                { "PK", new AttributeValue(productId) }
            });

        if (!product.IsItemSet)
        {
            return null;
        }

        var priceBracketProperty = product.Item[PriceBracketsItemKey]?.S ?? "[]";

        return Product.From(new ProductId(product.Item[PartitionKeyItemKey].S), new ProductName(product.Item[NameItemKey].S), new ProductPrice(decimal.Parse(product.Item[PriceItemKey].N)), JsonSerializer.Deserialize<List<ProductPriceBracket>>(priceBracketProperty)!);
    }

    public async Task RemoveWithId(string productId)
    {
        await dynamoDbClient.DeleteItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(1)
        {
            { "PK", new AttributeValue(productId) }
        });
    }

    public async Task AddNew(Product product)
    {
        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(4)
        {
            { PartitionKeyItemKey, new AttributeValue(product.ProductId) },
            { NameItemKey, new AttributeValue(product.Details.Name) },
            { PriceItemKey, new AttributeValue(){N = product.Details.Price.ToString("n2")} },
            { PriceBracketsItemKey, new AttributeValue(JsonSerializer.Serialize(product.PriceBrackets))}
        });
    }

    public async Task UpdateExistingFrom(Product product)
    {
        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(4)
        {
            { PartitionKeyItemKey, new AttributeValue(product.ProductId) },
            { NameItemKey, new AttributeValue(product.Details.Name) },
            { PriceItemKey, new AttributeValue(){N = product.Details.Price.ToString("n2")} },
            { PriceBracketsItemKey, new AttributeValue(JsonSerializer.Serialize(product.PriceBrackets))}
        });
    }
}