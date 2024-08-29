namespace Product.Api.Core;

public interface IProductRepository
{
    Task<Product?> GetProduct(string productId);
    
    Task DeleteProduct(string productId);

    Task CreateProduct(Product product);
    
    Task UpdateProduct(Product product);
}