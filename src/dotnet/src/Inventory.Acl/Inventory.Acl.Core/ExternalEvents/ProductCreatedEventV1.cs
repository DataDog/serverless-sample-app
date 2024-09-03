namespace Inventory.Acl.Core.ExternalEvents;

public record ProductCreatedEventV1
{
    public string ProductId { get; set; } = "";
}