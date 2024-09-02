namespace ProductApi.Core;

public record ProductUpdatedEvent
{
    public ProductUpdatedEvent(Product product)
    {
        this.ProductId = product.ProductId;
        this.Previous = product.PreviousDetails;
        this.Updated = product.Details;
    }
    
    public string ProductId { get; set; }

    public ProductDetails? Previous { get; set; }

    public ProductDetails Updated { get; set; }
}