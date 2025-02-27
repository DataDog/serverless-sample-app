// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Globalization;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Orders.Core.Adapters;

public class DynamoDBOrders(AmazonDynamoDBClient dynamoDbClient, ILogger<DynamoDBOrders> logger, IConfiguration configuration)
    : IOrders
{
    private const string PARTITION_KEY = "PK";
    private const string SORT_KEY = "SK";
    private const string USER_ID = "userId";
    private const string ORDER_NUMBER = "orderNumber";
    private const string TYPE = "Type";
    private const string ORDER_DATE = "orderDate";
    private const string ORDER_TYPE = "orderType";
    private const string ORDER_STATUS = "orderStatus";
    private const string TOTAL_PRICE = "totalPrice";
    private const string PRODUCTS = "products";
    private const string DATE_TIME_FORMAT = "yyyyMMddHHmmss";
    
    public async Task<Order?> WithOrderId(string userId, string orderId)
    {
        logger.LogInformation("Retrieving Order with orderId {orderId} from DynamoDB", orderId);

        var getItemResult = await dynamoDbClient.GetItemAsync(configuration["TABLE_NAME"],
            new Dictionary<string, AttributeValue>()
            {
                { PARTITION_KEY, new AttributeValue(userId) },
                { SORT_KEY, new AttributeValue(orderId) },
            });

        if (!getItemResult.IsItemSet) return null;

        return Order.From(
            getItemResult.Item[USER_ID].S,
            getItemResult.Item[ORDER_NUMBER].S,
            DateTime.ParseExact(getItemResult.Item[ORDER_DATE].S, DATE_TIME_FORMAT, CultureInfo.InvariantCulture),
            (OrderType)Enum.ToObject(typeof(OrderType), int.Parse(getItemResult.Item[ORDER_TYPE].N)),
            decimal.Parse(getItemResult.Item[TOTAL_PRICE].N),
            getItemResult.Item[PRODUCTS].SS.ToArray(),
            (OrderStatus)Enum.ToObject(typeof(OrderStatus), int.Parse(getItemResult.Item[ORDER_STATUS].N)));
        ;
    }

    public async Task Store(Order order)
    {
        logger.LogInformation("Updating Order with orderNumber {orderId}", order.OrderNumber);

        await dynamoDbClient.PutItemAsync(configuration["TABLE_NAME"],
            new Dictionary<string, AttributeValue>()
            {
                { PARTITION_KEY, new AttributeValue(order.UserId) },
                { SORT_KEY, new AttributeValue(order.OrderNumber) },
                { USER_ID, new AttributeValue(order.UserId) },
                { ORDER_NUMBER, new AttributeValue(order.OrderNumber) },
                { ORDER_DATE, new AttributeValue(order.OrderDate.ToString(DATE_TIME_FORMAT)) },
                { ORDER_TYPE, new AttributeValue() { N = ((int)order.OrderType).ToString("n0") } },
                { ORDER_STATUS, new AttributeValue() { N = ((int)order.OrderStatus).ToString("n0") } },
                { TOTAL_PRICE, new AttributeValue() { N = order.TotalPrice.ToString("n2") } },
                { PRODUCTS, new AttributeValue(order.Products.ToList())},
                { TYPE, new AttributeValue("Order") }
            });
    }
}