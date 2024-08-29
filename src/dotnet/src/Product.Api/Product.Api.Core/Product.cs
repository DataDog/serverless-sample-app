namespace Product.Api.Core;

public class Product
{
    public string ProductId { get; private set; } = "";
    public ProductDetails Details { get; private set; }
    
    public ProductDetails? PreviousDetails { get; private set; }

    public List<ProductPriceBracket> PriceBrackets { get; private set; }
    
    public bool IsUpdated { get; private set; }

    public static Product From(string productId, string name, decimal price)
    {
        return new Product()
        {
            ProductId = productId,
            Details = new ProductDetails(name, price),
            PriceBrackets = new List<ProductPriceBracket>(0)
        };
    }

    internal Product()
    {
        this.Details = new ProductDetails("", -1);
        this.PriceBrackets = new List<ProductPriceBracket>(0);
    }

    internal Product(string name, decimal price)
    {
        ProductId = Guid.NewGuid().ToString();
        Details = new ProductDetails(name, price);
        PriceBrackets = new List<ProductPriceBracket>();
    }

    public void UpdateProduct(string name, decimal price)
    {
        var newName = Details.Name;
        var newPrice = Details.Price;
        
        if (Details.Name != name)
        {
            newName = name;
            this.IsUpdated = true;
        }

        if (Details.Price != price)
        {
            newPrice = price;
            this.IsUpdated = true;
        }

        if (!IsUpdated) return;
        
        this.PreviousDetails = Details;
        this.Details = new ProductDetails(newName, newPrice);
    }
}