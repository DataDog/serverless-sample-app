// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core;

public record ProductId(string Value);

public class Product
{
    public string ProductId { get; private set; } = "";

    public int CurrentStockLevel { get; private set; }

    public ProductDetails Details { get; private set; }

    public ProductDetails? PreviousDetails { get; private set; }

    public List<ProductPriceBracket> PriceBrackets { get; private set; }

    public bool IsUpdated { get; private set; }

    public static Product From(ProductId productId, ProductName name, ProductPrice price, int currentStockLevel,
        List<ProductPriceBracket> priceBrackets)
    {
        return new Product(productId, name, price, currentStockLevel)
        {
            PriceBrackets = priceBrackets
        };
    }

    private Product(ProductId productId, ProductName name, ProductPrice price, int currentStockLevel)
    {
        ProductId = productId.Value;
        Details = new ProductDetails(name, price);
        PriceBrackets = new List<ProductPriceBracket>();
        CurrentStockLevel = currentStockLevel;
    }

    internal Product()
    {
        Details = new ProductDetails(new ProductName(""), new ProductPrice(-1));
        PriceBrackets = new List<ProductPriceBracket>(0);
        CurrentStockLevel = 0;
    }

    internal Product(ProductName name, ProductPrice price)
    {
        ProductId = Guid.NewGuid().ToString();
        Details = new ProductDetails(name, price);
        PriceBrackets = new List<ProductPriceBracket>();
        CurrentStockLevel = 0;
    }

    public void UpdateProductDetailsFrom(ProductDetails newDetails)
    {
        if (Details != newDetails)
        {
            PreviousDetails = Details;
            Details = newDetails;
            IsUpdated = true;
        }
    }

    public void UpdateStockLevels(int newStockLevel)
    {
        CurrentStockLevel = newStockLevel < 0 ? 0 : newStockLevel;
    }

    public void ClearPricing()
    {
        PriceBrackets = new List<ProductPriceBracket>(0);
        IsUpdated = true;
    }

    public void AddPricing(ProductPriceBracket priceBracket)
    {
        PriceBrackets.Add(priceBracket);
    }
}