using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Microsoft.Extensions.Configuration;
using Product.Api.Core;

namespace Product.Api.Adapters;

public class DynamoDbProductRepository(
    AmazonDynamoDBClient dynamoDbClient,
    IConfiguration configuration)
    : IProductRepository
{
    private const string PartitionKeyItemKey = "PK";
    private const string NameItemKey = "Name";
    private const string PriceItemKey = "Price";
    public async Task<Core.Product?> GetProduct(string productId)
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

        return Core.Product.From(product.Item[PartitionKeyItemKey].S, product.Item[NameItemKey].S, decimal.Parse(product.Item[PriceItemKey].N));
    }

    public async Task DeleteProduct(string productId)
    {
        await dynamoDbClient.DeleteItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(1)
        {
            { "PK", new AttributeValue(productId) }
        });
    }

    public async Task CreateProduct(Core.Product product)
    {
        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(1)
        {
            { PartitionKeyItemKey, new AttributeValue(product.ProductId) },
            { NameItemKey, new AttributeValue(product.Details.Name) },
            { PriceItemKey, new AttributeValue(){N = product.Details.Price.ToString("n2")} },
        });
    }

    public async Task UpdateProduct(Core.Product product)
    {
        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(1)
        {
            { PartitionKeyItemKey, new AttributeValue(product.ProductId) },
            { NameItemKey, new AttributeValue(product.Details.Name) },
            { PriceItemKey, new AttributeValue(){N = product.Details.Price.ToString("n2")} },
        });
    }
}