using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Api.Core;
using Microsoft.Extensions.Configuration;

namespace Api.Adapters;

public class DynamoDbOrderRepository(
    AmazonDynamoDBClient dynamoDbClient,
    IConfiguration configuration,
    IEventPublisher eventPublisher)
    : IOrderRepository
{
    public async Task<Order> GetOrder(string orderId)
    {
        var order = await dynamoDbClient.GetItemAsync(configuration["TABLE_NAME"],
            new Dictionary<string, AttributeValue>()
            {
                { "PK", new AttributeValue(orderId) }
            });

        if (!order.IsItemSet)
        {
            throw new Exception("Order not found");
        }

        return new Order()
        {
            OrderId = order.Item["PK"].S
        };
    }

    public async Task CreateOrder(Order order)
    {
        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"], new Dictionary<string, AttributeValue>(1)
        {
            { "PK", new AttributeValue(order.OrderId) }
        });

        await eventPublisher.Publish(new OrderCreatedEvent()
        {
            OrderId = order.OrderId
        });
    }
}