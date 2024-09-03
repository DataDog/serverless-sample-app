namespace ProductEventPublisher.Core.InternalEvents;

public record ProductDeletedEvent
{
    public string ProductId { get; set; } = "";
}