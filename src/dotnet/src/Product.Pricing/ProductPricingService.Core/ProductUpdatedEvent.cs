namespace ProductPricingService.Core;

public record ProductUpdatedEvent
{
    public string ProductId { get; set; }
    
    public decimal Price { get; set; }
}