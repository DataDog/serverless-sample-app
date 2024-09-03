namespace ProductApi.Core;

public class ProductPriceBracket(decimal quantity, decimal price)
{
    public decimal Price { get; } = price;
    public decimal Quantity { get; } = quantity;
}