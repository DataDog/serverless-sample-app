namespace ProductEventPublisher.Core.ExternalEvents;

public record ProductDeletedEventV1{
    public string ProductId { get; set; } = "";
}