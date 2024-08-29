namespace BackgroundWorkers.IntegrationEvents;

public record OrderCreatedIntegrationEvent
{
    public string OrderId { get; set; } = "";
}