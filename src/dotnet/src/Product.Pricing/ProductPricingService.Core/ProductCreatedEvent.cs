namespace ProductPricingService.Core;

public record ProductCreatedEvent
{
    public decimal Price { get; set; }
}