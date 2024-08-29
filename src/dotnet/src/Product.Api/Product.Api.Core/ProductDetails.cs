namespace Product.Api.Core;

public record ProductDetails(string Name, decimal Price)
{
    public string Name { get; private set; } = Name;
    public decimal Price { get; private set; } = Price;
}