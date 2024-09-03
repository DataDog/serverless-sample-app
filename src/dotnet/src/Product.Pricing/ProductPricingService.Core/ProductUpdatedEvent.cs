namespace ProductPricingService.Core;

public record ProductUpdatedEvent
{
    public string ProductId { get; set; }
    
    public PriceDetails Updated { get; set; }
}

public record PriceDetails
{
    public decimal Price { get; set; }
}