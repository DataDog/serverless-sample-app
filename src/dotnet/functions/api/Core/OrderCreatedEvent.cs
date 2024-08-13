namespace Api.Core;

public record OrderCreatedEvent
{
    public string OrderId { get; set; } = "";
}