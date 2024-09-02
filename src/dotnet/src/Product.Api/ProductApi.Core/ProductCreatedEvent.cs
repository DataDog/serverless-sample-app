namespace ProductApi.Core;

public record ProductCreatedEvent
{
    public ProductCreatedEvent(Product product)
    {
        this.ProductId = product.ProductId;
        this.Name = product.Details.Name;
        this.Price = product.Details.Price;
    }
    
    public string ProductId { get; set; }

    public string Name { get; set; }

    public decimal Price { get; set; }
}