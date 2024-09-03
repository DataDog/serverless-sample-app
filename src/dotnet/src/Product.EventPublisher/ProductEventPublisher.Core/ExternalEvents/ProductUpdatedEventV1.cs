namespace ProductEventPublisher.Core.ExternalEvents;

public record ProductUpdatedEventV1
{
    public string ProductId { get; set; } = "";
}