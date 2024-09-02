namespace ProductApi.Core;

public record ProductDeletedEvent
{
    public ProductDeletedEvent(string productId)
    {
        this.ProductId = productId;
    }
    
    public string ProductId { get; set; }
}