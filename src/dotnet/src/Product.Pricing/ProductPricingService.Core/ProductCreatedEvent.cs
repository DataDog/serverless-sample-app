namespace ProductPricingService.Core;

public record ProductCreatedEvent
{
    public string ProductId { get; set; }
    public decimal Price { get; set; }
}