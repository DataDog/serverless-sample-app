namespace Api.Core;

public interface IOrderRepository
{
    Task<Order> GetOrder(string orderId);

    Task CreateOrder(Order order);
}