// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core.Test;

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
        var product = Product.From(new ProductId("testid"), new ProductName("Test name"), new ProductPrice(12), new List<ProductPriceBracket>());

        Assert.Equal("testid", product.ProductId);
    }
    
    [Fact]
    public void UpdateProduct_WithNoChanges_ShouldSetIsUpdatedFalse()
    {
        var product = Product.From(new ProductId("testid"), new ProductName("Test name"), new ProductPrice(12), new List<ProductPriceBracket>());
        
        product.UpdateProductDetailsFrom(new ProductDetails(new ProductName("Test name"), new ProductPrice(12)));

        Assert.False(product.IsUpdated);
    }
    
    [Fact]
    public void UpdateProduct_WithChanges_ShouldSetIsUpdatedTrue()
    {
        var product = Product.From(new ProductId("testid"), new ProductName("Test name"), new ProductPrice(12), new List<ProductPriceBracket>());
        
        product.UpdateProductDetailsFrom(new ProductDetails(new ProductName("New name"), new ProductPrice(15.5M)));

        Assert.True(product.IsUpdated);
        Assert.Equal("New name", product.Details.Name);
        Assert.Equal(15.5M, product.Details.Price);
    }
    
    [Fact]
    public void CheckPricingUpdates_WithValidPricing_ShouldUpdate()
    {
        var product = Product.From(new ProductId("testid"), new ProductName("Test name"), new ProductPrice(12), new List<ProductPriceBracket>());

        product.ClearPricing();

        product.AddPricing(new ProductPriceBracket(5, 10.0M));

        Assert.True(product.IsUpdated);
        Assert.Single(product.PriceBrackets);
        Assert.NotNull(product.PriceBrackets.FirstOrDefault(p => p.Quantity == 5 && p.Price == 10.0M));
    }
}