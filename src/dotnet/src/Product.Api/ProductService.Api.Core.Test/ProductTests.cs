namespace ProductService.Api.Core.Test;

public class ProductTests
{
    [Fact]
    public void CreateProduct_WithValidProperties_ShouldSucceed()
    {
        var product = new Product(new ProductName("Test name"), new ProductPrice(12));

        Assert.NotNull(product.ProductId);
    }
    
    [Fact]
    public void CreateProductUsingFrom_WithValidProperties_ShouldSucceed()
    {
        var product = Product.From(new ProductId("testid"), new ProductName("Test name"), new ProductPrice(12));

        Assert.Equal("testid", product.ProductId);
    }
    
    [Fact]
    public void UpdateProduct_WithNoChanges_ShouldSetIsUpdatedFalse()
    {
        var product = Product.From(new ProductId("testid"), new ProductName("Test name"), new ProductPrice(12));
        
        product.UpdateProductDetailsFrom(new ProductDetails(new ProductName("Test name"), new ProductPrice(12)));

        Assert.False(product.IsUpdated);
    }
    
    [Fact]
    public void UpdateProduct_WithChanges_ShouldSetIsUpdatedTrue()
    {
        var product = Product.From(new ProductId("testid"), new ProductName("Test name"), new ProductPrice(12));
        
        product.UpdateProductDetailsFrom(new ProductDetails(new ProductName("New name"), new ProductPrice(15.5M)));

        Assert.True(product.IsUpdated);
        Assert.Equal("New name", product.Details.Name);
        Assert.Equal(15.5M, product.Details.Price);
    }
}