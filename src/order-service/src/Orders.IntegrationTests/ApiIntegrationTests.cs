using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.Lambda.CloudWatchEvents;
using Amazon.SimpleSystemsManagement;
using Xunit.Abstractions;

namespace Orders.IntegrationTests;

public class ApiIntegrationTests
{
    private readonly ITestOutputHelper _outputHelper;
    private readonly ApiDriver _apiDriver;

    public ApiIntegrationTests(ITestOutputHelper outputHelper)
    {
        _outputHelper = outputHelper;
        var env = Environment.GetEnvironmentVariable("ENV");
        _apiDriver = new ApiDriver(outputHelper, env, new AmazonSimpleSystemsManagementClient());
    }

    [Fact]
    public async Task WhenUserIsValid_CanCreateOrder()
    {
        var createOrderResult = await _apiDriver.CreateOrderFor(new[] { "JAMES123" });

        Assert.True(createOrderResult.IsSuccessStatusCode);

        var order = JsonSerializer.Deserialize<OrderDTO>(await createOrderResult.Content.ReadAsStringAsync());

        var orderCreatedWasPublished =
            await _apiDriver.VerifyEventPublishedFor(order.OrderId, "orders.orderCreated.v1");
        Assert.True(orderCreatedWasPublished);

        var getOrderResult = await _apiDriver.GetOrderDetailsFor(order.OrderId);

        Assert.True(getOrderResult.IsSuccessStatusCode);
        Assert.Equal("Created", order.OrderStatus);

        await _apiDriver.StockReservationSuccessfulFor(order.OrderId);

        getOrderResult = await _apiDriver.GetOrderDetailsFor(order.OrderId);

        order = JsonSerializer.Deserialize<OrderDTO>(await getOrderResult.Content.ReadAsStringAsync());

        Assert.Equal("Confirmed", order.OrderStatus);

        var orderConfirmedWasPublished =
            await _apiDriver.VerifyEventPublishedFor(order.OrderId, "orders.orderConfirmed.v1");

        Assert.True(orderConfirmedWasPublished, "Order confirmed event was not published");
    }

    [Fact]
    public async Task WhenOutOfStockEventReceived_OrderSetToNoStock()
    {
        var createOrderResult = await _apiDriver.CreateOrderFor(new[] { "JAMES123" });

        _outputHelper.WriteLine("Create order response status code is " + createOrderResult.StatusCode);

        Assert.True(createOrderResult.IsSuccessStatusCode);

        var order = JsonSerializer.Deserialize<OrderDTO>(await createOrderResult.Content.ReadAsStringAsync());

        var getOrderResult = await _apiDriver.GetOrderDetailsFor(order.OrderId);

        Assert.True(getOrderResult.IsSuccessStatusCode);
        Assert.Equal("Created", order.OrderStatus);

        await _apiDriver.StockReservationFailedFor(order.OrderId);

        getOrderResult = await _apiDriver.GetOrderDetailsFor(order.OrderId);

        order = JsonSerializer.Deserialize<OrderDTO>(await getOrderResult.Content.ReadAsStringAsync());

        Assert.Equal("NoStock", order.OrderStatus);
    }

    [Fact]
    public async Task WhenUserIsValid_CanCreateAndCompleteOrder()
    {
        var createOrderResult = await _apiDriver.CreateOrderFor(new[] { "JAMES123" });

        _outputHelper.WriteLine("Create order response status code is " + createOrderResult.StatusCode);

        Assert.True(createOrderResult.IsSuccessStatusCode);

        var order = JsonSerializer.Deserialize<OrderDTO>(await createOrderResult.Content.ReadAsStringAsync());

        var getOrderResult = await _apiDriver.GetOrderDetailsFor(order.OrderId);
        order = JsonSerializer.Deserialize<OrderDTO>(await getOrderResult.Content.ReadAsStringAsync());

        await _apiDriver.StockReservationSuccessfulFor(order.OrderId);

        var confirmedOrderResponse = await _apiDriver.GetConfirmedOrders();
        var response = await confirmedOrderResponse.Content.ReadAsStringAsync();

        _outputHelper.WriteLine($"List confirmed order response was {response}");

        var confirmedOrders =
            JsonSerializer.Deserialize<List<OrderDTO>>(response);

        Assert.Contains(confirmedOrders, o => o.OrderId == order.OrderId);

        await _apiDriver.OrderCompleted(order.OrderId, order.UserId);

        await _apiDriver.VerifyEventPublishedFor(order.OrderId, "orders.orderCompleted.v1");
    }

    [Fact]
    public async Task IfNoStockReservationResponseReceived_ShouldRetryPublishOfOrderCreated()
    {
        var createOrderResult = await _apiDriver.CreateOrderFor(new[] { "JAMES123" });

        _outputHelper.WriteLine("Create order response status code is " + createOrderResult.StatusCode);

        Assert.True(createOrderResult.IsSuccessStatusCode);

        var order = JsonSerializer.Deserialize<OrderDTO>(await createOrderResult.Content.ReadAsStringAsync());

        var getOrderResult = await _apiDriver.GetOrderDetailsFor(order.OrderId);

        Assert.True(getOrderResult.IsSuccessStatusCode);
        Assert.Equal("Created", order.OrderStatus);

        // The workflow waits 60 seconds and then retries
        await Task.Delay(TimeSpan.FromSeconds(70));

        var orderCreatedWasPublishedTwice =
            await _apiDriver.VerifyEventPublishedFor(order.OrderId, "orders.orderCreated.v1", 2);
        Assert.True(orderCreatedWasPublishedTwice, "Order Created event should have been published twice");

        await _apiDriver.StockReservationSuccessfulFor(order.OrderId);

        getOrderResult = await _apiDriver.GetOrderDetailsFor(order.OrderId);

        order = JsonSerializer.Deserialize<OrderDTO>(await getOrderResult.Content.ReadAsStringAsync());

        Assert.Equal("Confirmed", order.OrderStatus);
    }
}