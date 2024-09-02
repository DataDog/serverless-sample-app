namespace ProductApi.Core;

public class ProductPriceBracket
{
    private decimal _price;
    private decimal _quantity;

    public ProductPriceBracket(decimal price, decimal quantity)
    {
        _price = price;
        _quantity = quantity;
    }
}