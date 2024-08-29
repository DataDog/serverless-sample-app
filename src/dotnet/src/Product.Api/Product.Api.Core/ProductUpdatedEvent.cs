namespace Product.Api.Core;

public record ProductUpdatedEvent(Product Product)
{
    public string ProductId { get; set; } = Product.ProductId;

    public ProductDetails? Previous { get; set; } = Product.PreviousDetails;

    public ProductDetails Updated { get; set; } = Product.Details;
}