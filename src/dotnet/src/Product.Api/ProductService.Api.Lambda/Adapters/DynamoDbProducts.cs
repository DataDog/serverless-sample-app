using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Microsoft.Extensions.Configuration;
using ProductService.Api.Core;

namespace ProductService.Api.Adapters;

public class DynamoDbProducts(
    AmazonDynamoDBClient dynamoDbClient,
    IConfiguration configuration)
    : IProducts
{
    private const string PartitionKeyItemKey = "PK";
    private const string NameItemKey = "Name";
    private const string PriceItemKey = "Price";
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

        return Product.From(new ProductId(product.Item[PartitionKeyItemKey].S), new ProductName(product.Item[NameItemKey].S), new ProductPrice(decimal.Parse(product.Item[PriceItemKey].N)));
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
        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(1)
        {
            { PartitionKeyItemKey, new AttributeValue(product.ProductId) },
            { NameItemKey, new AttributeValue(product.Details.Name) },
            { PriceItemKey, new AttributeValue(){N = product.Details.Price.ToString("n2")} },
        });
    }

    public async Task UpdateExistingFrom(Product product)
    {
        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(1)
        {
            { PartitionKeyItemKey, new AttributeValue(product.ProductId) },
            { NameItemKey, new AttributeValue(product.Details.Name) },
            { PriceItemKey, new AttributeValue(){N = product.Details.Price.ToString("n2")} },
        });
    }
}