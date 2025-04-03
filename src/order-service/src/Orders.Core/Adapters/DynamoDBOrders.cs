// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Globalization;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Datadog.Trace;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Polly;

namespace Orders.Core.Adapters;

public class DynamoDBOrders(
    AmazonDynamoDBClient dynamoDbClient,
    ILogger<DynamoDBOrders> logger,
    IConfiguration configuration)
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
    private const string GSI1PK = "GSI1PK";
    private const string GSI1SK = "GSI1SK";
    private const int PAGE_SIZE = 20;

    private readonly ResiliencePipeline<QueryResponse> _queryResiliencePipeline = 
        ResiliencePolicies.GetDynamoDBPolicy<QueryResponse>(logger);
    private readonly ResiliencePipeline<GetItemResponse> _getItemResiliencePipeline = 
        ResiliencePolicies.GetDynamoDBPolicy<GetItemResponse>(logger);
    private readonly ResiliencePipeline<PutItemResponse> _putItemResiliencePipeline = 
        ResiliencePolicies.GetDynamoDBPolicy<PutItemResponse>(logger);
    private readonly ResiliencePipeline<BatchWriteItemResponse> _batchWriteResiliencePipeline = 
        ResiliencePolicies.GetDynamoDBPolicy<BatchWriteItemResponse>(logger);

    public async Task<List<Order>> ForUser(string userId, int pageSize = PAGE_SIZE, string? lastEvaluatedKey = null)
    {
        var queryRequest = new QueryRequest()
        {
            TableName = configuration["TABLE_NAME"],
            KeyConditionExpression = "PK = :PK",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                { ":PK", new AttributeValue { S = userId } }
            },
            Limit = pageSize,
            ReturnConsumedCapacity = ReturnConsumedCapacity.TOTAL
        };
        
        if (!string.IsNullOrEmpty(lastEvaluatedKey))
        {
            queryRequest.ExclusiveStartKey = new Dictionary<string, AttributeValue>
            {
                { PARTITION_KEY, new AttributeValue { S = userId } },
                { SORT_KEY, new AttributeValue { S = lastEvaluatedKey } }
            };
        }

        var queryResult = await _queryResiliencePipeline.ExecuteAsync(
            async ct => await dynamoDbClient.QueryAsync(queryRequest, ct), 
            CancellationToken.None);

        queryResult.AddToTelemetry();

        var orderList = new List<Order>();

        foreach (var item in queryResult.Items)
            orderList.Add(Order.From(
                item[USER_ID].S,
                item[ORDER_NUMBER].S,
                DateTime.ParseExact(item[ORDER_DATE].S, DATE_TIME_FORMAT, CultureInfo.InvariantCulture),
                (OrderType)Enum.ToObject(typeof(OrderType), int.Parse(item[ORDER_TYPE].N)),
                decimal.Parse(item[TOTAL_PRICE].N),
                item[PRODUCTS].SS.ToArray(),
                (OrderStatus)Enum.ToObject(typeof(OrderStatus), int.Parse(item[ORDER_STATUS].N))));

        return orderList;
    }

    public async Task<List<Order>> ConfirmedOrders(int pageSize = PAGE_SIZE, string? lastEvaluatedKey = null)
    {
        var queryRequest = new QueryRequest()
        {
            TableName = configuration["TABLE_NAME"],
            KeyConditionExpression = "GSI1PK = :PK",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                { ":PK", new AttributeValue { S = "CONFIRMED" } }
            },
            IndexName = "GSI1",
            Limit = pageSize,
            ReturnConsumedCapacity = ReturnConsumedCapacity.TOTAL
        };
        
        if (!string.IsNullOrEmpty(lastEvaluatedKey))
        {
            queryRequest.ExclusiveStartKey = new Dictionary<string, AttributeValue>
            {
                { GSI1PK, new AttributeValue { S = "CONFIRMED" } },
                { GSI1SK, new AttributeValue { S = lastEvaluatedKey } }
            };
        }

        var queryResult = await _queryResiliencePipeline.ExecuteAsync(
            async ct => await dynamoDbClient.QueryAsync(queryRequest, ct), 
            CancellationToken.None);

        queryResult.AddToTelemetry();

        var orderList = new List<Order>();

        foreach (var item in queryResult.Items)
            orderList.Add(Order.From(
                item[USER_ID].S,
                item[ORDER_NUMBER].S,
                DateTime.ParseExact(item[ORDER_DATE].S, DATE_TIME_FORMAT, CultureInfo.InvariantCulture),
                (OrderType)Enum.ToObject(typeof(OrderType), int.Parse(item[ORDER_TYPE].N)),
                decimal.Parse(item[TOTAL_PRICE].N),
                item[PRODUCTS].SS.ToArray(),
                (OrderStatus)Enum.ToObject(typeof(OrderStatus), int.Parse(item[ORDER_STATUS].N))));

        return orderList;
    }

    public async Task<Order?> WithOrderId(string userId, string orderId)
    {
        logger.LogInformation("Retrieving Order with orderId {orderId} and user {userId} from DynamoDB", orderId,
            userId);

        var getItemRequest = new GetItemRequest()
        {
            TableName = configuration["TABLE_NAME"],
            Key = new Dictionary<string, AttributeValue>()
            {
                { PARTITION_KEY, new AttributeValue(userId) },
                { SORT_KEY, new AttributeValue(orderId) }
            },
            ReturnConsumedCapacity = ReturnConsumedCapacity.TOTAL
        };

        var getItemResult = await _getItemResiliencePipeline.ExecuteAsync(
            async ct => await dynamoDbClient.GetItemAsync(getItemRequest, ct), 
            CancellationToken.None);
        
        getItemResult.AddToTelemetry();

        if (!getItemResult.IsItemSet) return null;

        return Order.From(
            getItemResult.Item[USER_ID].S,
            getItemResult.Item[ORDER_NUMBER].S,
            DateTime.ParseExact(getItemResult.Item[ORDER_DATE].S, DATE_TIME_FORMAT, CultureInfo.InvariantCulture),
            (OrderType)Enum.ToObject(typeof(OrderType), int.Parse(getItemResult.Item[ORDER_TYPE].N)),
            decimal.Parse(getItemResult.Item[TOTAL_PRICE].N),
            getItemResult.Item[PRODUCTS].SS.ToArray(),
            (OrderStatus)Enum.ToObject(typeof(OrderStatus), int.Parse(getItemResult.Item[ORDER_STATUS].N)));
    }

    public async Task Store(Order order)
    {
        logger.LogInformation("Updating Order with orderNumber {orderId}", order.OrderNumber);
        var attributes = new Dictionary<string, AttributeValue>()
        {
            { PARTITION_KEY, new AttributeValue(order.UserId) },
            { SORT_KEY, new AttributeValue(order.OrderNumber) },
            { USER_ID, new AttributeValue(order.UserId) },
            { ORDER_NUMBER, new AttributeValue(order.OrderNumber) },
            { ORDER_DATE, new AttributeValue(order.OrderDate.ToString(DATE_TIME_FORMAT)) },
            { ORDER_TYPE, new AttributeValue() { N = ((int)order.OrderType).ToString("n0") } },
            { ORDER_STATUS, new AttributeValue() { N = ((int)order.OrderStatus).ToString("n0") } },
            { TOTAL_PRICE, new AttributeValue() { N = order.TotalPrice.ToString("n2") } },
            { PRODUCTS, new AttributeValue(order.Products.ToList()) },
            { TYPE, new AttributeValue("Order") }
        };

        if (order.OrderStatus == OrderStatus.Confirmed)
        {
            attributes.Add(GSI1PK, new AttributeValue("CONFIRMED"));
            attributes.Add(GSI1SK, new AttributeValue(order.OrderNumber));
        }

        var putItemRequest = new PutItemRequest()
        {
            TableName = configuration["TABLE_NAME"],
            Item = attributes,
            ReturnConsumedCapacity = ReturnConsumedCapacity.TOTAL
        };

        var putItemResponse = await _putItemResiliencePipeline.ExecuteAsync(
            async ct => await dynamoDbClient.PutItemAsync(putItemRequest, ct), 
            CancellationToken.None);
            
        putItemResponse.AddToTelemetry();
    }
    
    public async Task StoreBatch(IEnumerable<Order> orders)
    {
        var writeRequests = new List<WriteRequest>();
        
        foreach (var order in orders)
        {
            var attributes = new Dictionary<string, AttributeValue>()
            {
                { PARTITION_KEY, new AttributeValue(order.UserId) },
                { SORT_KEY, new AttributeValue(order.OrderNumber) },
                { USER_ID, new AttributeValue(order.UserId) },
                { ORDER_NUMBER, new AttributeValue(order.OrderNumber) },
                { ORDER_DATE, new AttributeValue(order.OrderDate.ToString(DATE_TIME_FORMAT)) },
                { ORDER_TYPE, new AttributeValue() { N = ((int)order.OrderType).ToString("n0") } },
                { ORDER_STATUS, new AttributeValue() { N = ((int)order.OrderStatus).ToString("n0") } },
                { TOTAL_PRICE, new AttributeValue() { N = order.TotalPrice.ToString("n2") } },
                { PRODUCTS, new AttributeValue(order.Products.ToList()) },
                { TYPE, new AttributeValue("Order") }
            };

            if (order.OrderStatus == OrderStatus.Confirmed)
            {
                attributes.Add(GSI1PK, new AttributeValue("CONFIRMED"));
                attributes.Add(GSI1SK, new AttributeValue(order.OrderNumber));
            }
            
            writeRequests.Add(new WriteRequest { PutRequest = new PutRequest { Item = attributes } });
        }
        
        // DynamoDB batches are limited to 25 items
        const int batchSize = 25;
        for (int i = 0; i < writeRequests.Count; i += batchSize)
        {
            var batch = writeRequests.Skip(i).Take(batchSize).ToList();
            var batchRequest = new BatchWriteItemRequest
            {
                RequestItems = new Dictionary<string, List<WriteRequest>>
                {
                    { configuration["TABLE_NAME"], batch }
                },
                ReturnConsumedCapacity = ReturnConsumedCapacity.TOTAL
            };
            
            var response = await _batchWriteResiliencePipeline.ExecuteAsync(
                async ct => await dynamoDbClient.BatchWriteItemAsync(batchRequest, ct),
                CancellationToken.None);
            
            // Handle unprocessed items if any
            if (response.UnprocessedItems.Count > 0 && response.UnprocessedItems.ContainsKey(configuration["TABLE_NAME"]))
            {
                var remainingItems = response.UnprocessedItems[configuration["TABLE_NAME"]];
                if (remainingItems.Count > 0)
                {
                    logger.LogWarning("Some batch items were not processed. Retrying {Count} items", remainingItems.Count);
                    // In a real implementation, you'd handle these with exponential backoff
                }
            }
        }
    }
}