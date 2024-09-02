namespace ProductApi.Core.PricingChanged;

public class PricingUpdatedEventHandler(IProducts Products)
{
    public async Task Handle(PricingUpdatedEvent evt)
    {
        var product = await Products.WithId(evt.ProductId);

        if (product is null)
        {
            return;
        }
        
        product.ClearPricing();

        foreach (var price in evt.PriceBrackets)
        {
            product.AddPricing(new ProductPriceBracket(price.Key, price.Value));
        }

        await Products.UpdateExistingFrom(product);
    }
}