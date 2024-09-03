namespace Inventory.Acl.Core.InternalEvents;

public record NewProductAddedEvent
{
    public string ProductId { get; set; } = "";
}