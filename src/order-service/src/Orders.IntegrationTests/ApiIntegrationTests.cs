using System.Text.Json;
using Amazon.SimpleSystemsManagement;

namespace Orders.IntegrationTests;

public class ApiIntegrationTests
{
    [Fact]
    public async Task WhenUserIsValid_CanCreateOrder()
    {
        var env = Environment.GetEnvironmentVariable("ENV");
        var apiDriver = new ApiDriver(env, new AmazonSimpleSystemsManagementClient());

        var productList = await apiDriver.LoadProductList();
        
        var createOrderResult = await apiDriver.CreateOrderFor(new[] { productList.FirstOrDefault() });
        
        Assert.True(createOrderResult.IsSuccessStatusCode);

        var order = JsonSerializer.Deserialize<OrderDTO>(await createOrderResult.Content.ReadAsStringAsync());

        var getOrderResult = await apiDriver.GetOrderDetailsFor(order.OrderId);
        
        Assert.True(getOrderResult.IsSuccessStatusCode);
    }
}