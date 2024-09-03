namespace Inventory.Acl.Core.ExternalEvents;

public record ProductUpdatedEventV1
{
    public string ProductId { get; set; } = "";
}