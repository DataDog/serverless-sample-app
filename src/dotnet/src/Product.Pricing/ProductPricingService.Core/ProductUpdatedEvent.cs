namespace ProductPricingService.Core;

public record ProductUpdatedEvent
{
    public decimal Price { get; set; }
}