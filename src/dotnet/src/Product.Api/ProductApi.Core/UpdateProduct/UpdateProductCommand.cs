namespace ProductApi.Core.UpdateProduct;

public record UpdateProductCommand(string Id, string Name, decimal Price);