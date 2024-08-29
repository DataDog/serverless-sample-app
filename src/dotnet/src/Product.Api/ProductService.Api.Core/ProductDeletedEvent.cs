namespace ProductService.Api.Core;

public record ProductDeletedEvent(string ProductId)
{
    public string ProductId { get; set; } = ProductId;
}