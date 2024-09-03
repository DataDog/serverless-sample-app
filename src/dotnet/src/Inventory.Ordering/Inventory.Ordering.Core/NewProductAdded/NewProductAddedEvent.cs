namespace Inventory.Ordering.Core.NewProductAdded;

public record NewProductAddedEvent
{
    public string ProductId { get; set; } = "";
}