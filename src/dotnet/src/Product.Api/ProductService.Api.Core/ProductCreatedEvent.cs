namespace ProductService.Api.Core;

public record ProductCreatedEvent(Product Product)
{
    public string ProductId { get; set; } = Product.ProductId;

    public string Name { get; set; } = Product.Details.Name;

    public decimal Price { get; set; } = Product.Details.Price;
}