namespace Product.Api.Core;

public record ProductDeletedEvent(string ProductId)
{
    public string ProductId { get; set; } = ProductId;
}