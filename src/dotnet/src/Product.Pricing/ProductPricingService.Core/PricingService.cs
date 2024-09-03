﻿namespace ProductPricingService.Core;

public class PricingService(IEventPublisher eventPublisher)
{
    public async Task GeneratePricingFor(string productId, ProductPrice price)
    {
        var pricingOptions = new Dictionary<int, decimal>(5)
        {
            { 5, price.Value * 0.95M },
            { 10, price.Value * 0.9M },
            { 25, price.Value * 0.8M },
            { 50, price.Value * 0.75M },
            { 100, price.Value * 0.7M }
        };

        await eventPublisher.Publish(new ProductPricingUpdatedEvent(productId, pricingOptions));
    } 
}