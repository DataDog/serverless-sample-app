using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon.Lambda.CloudWatchEvents;
using Amazon.SimpleSystemsManagement;
using Xunit.Abstractions;

namespace Orders.IntegrationTests;

public class ApiIntegrationTests
{
    private readonly ApiDriver _apiDriver;

    public ApiIntegrationTests(ITestOutputHelper outputHelper)
    {
        var env = Environment.GetEnvironmentVariable("ENV");
        _apiDriver = new ApiDriver(outputHelper, env, new AmazonSimpleSystemsManagementClient());
    }
    
    [Fact]
    public async Task WhenUserIsValid_CanCreateOrder()
    {
        var createOrderResult = await _apiDriver.CreateOrderFor(new[] { "JAMES123" });
        
        Assert.True(createOrderResult.IsSuccessStatusCode);

        var order = JsonSerializer.Deserialize<OrderDTO>(await createOrderResult.Content.ReadAsStringAsync());

        var getOrderResult = await _apiDriver.GetOrderDetailsFor(order.OrderId);
        
        Assert.True(getOrderResult.IsSuccessStatusCode);
        Assert.Equal("Created", order.OrderStatus);

        await _apiDriver.StockReservationSuccessfulFor(order.OrderId);

        getOrderResult = await _apiDriver.GetOrderDetailsFor(order.OrderId);
        
        order = JsonSerializer.Deserialize<OrderDTO>(await getOrderResult.Content.ReadAsStringAsync());
        
        Assert.Equal("Confirmed", order.OrderStatus);
    }
    
    [Fact]
    public async Task WhenOutOfStockEventReceived_OrderSetToNoStock()
    {
        var createOrderResult = await _apiDriver.CreateOrderFor(new[] { "JAMES123" });
        
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
}