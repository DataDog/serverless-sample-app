namespace ProductApi.Core;

public record ProductId(string Value);

public class Product
{
    public string ProductId { get; private set; } = "";
    public ProductDetails Details { get; private set; }
    
    public ProductDetails? PreviousDetails { get; private set; }

    public List<ProductPriceBracket> PriceBrackets { get; private set; }
    
    public bool IsUpdated { get; private set; }

    public static Product From(ProductId productId, ProductName name, ProductPrice price)
    {
        return new Product(productId, name, price);
    }
    
    private Product(ProductId productId, ProductName name, ProductPrice price)
    {
        ProductId = productId.Value;
        Details = new ProductDetails(name, price);
        PriceBrackets = new List<ProductPriceBracket>();
    }

    internal Product()
    {
        this.Details = new ProductDetails(new ProductName(""), new ProductPrice(-1));
        this.PriceBrackets = new List<ProductPriceBracket>(0);
    }

    internal Product(ProductName name, ProductPrice price)
    {
        ProductId = Guid.NewGuid().ToString();
        Details = new ProductDetails(name, price);
        PriceBrackets = new List<ProductPriceBracket>();
    }

    public void UpdateProductDetailsFrom(ProductDetails newDetails)
    {
        if (this.Details != newDetails)
        {
            PreviousDetails = Details;
            Details = newDetails;
            IsUpdated = true;
        }
    }

    public void ClearPricing()
    {
        this.PriceBrackets = new List<ProductPriceBracket>(0);
        this.IsUpdated = true;
    }

    public void AddPricing(ProductPriceBracket priceBracket)
    {
        this.PriceBrackets.Add(priceBracket);
    }
}