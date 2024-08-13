namespace BackgroundWorkers.PrivateEvents;

public record OrderCreatedEvent
{
    public string OrderId { get; set; } = "";
}