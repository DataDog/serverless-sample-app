namespace ProductService.Api.Core;

public interface IProducts
{
    Task<Product?> WithId(string productId);
    
    Task RemoveWithId(string productId);

    Task AddNew(Product product);
    
    Task UpdateExistingFrom(Product product);
}