namespace ProductEventPublisher.Core.InternalEvents;

public record ProductCreatedEvent
{
    public string ProductId { get; set; } = "";
    public decimal Price { get; set; } = 0M;
}