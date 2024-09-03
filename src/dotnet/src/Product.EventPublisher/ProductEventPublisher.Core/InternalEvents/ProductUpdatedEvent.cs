namespace ProductEventPublisher.Core.InternalEvents;

public record ProductUpdatedEvent
{
    public string ProductId { get; set; } = "";

    public PriceDetails Updated { get; set; } = new();
}

public record PriceDetails
{
    public decimal Price { get; set; } = 0M;
}