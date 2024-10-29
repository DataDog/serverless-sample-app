// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductPricingService.Core;

public class PricingService(IEventPublisher eventPublisher)
{
    public async Task GeneratePricingFor(string productId, ProductPrice price)
    {
        if (price.Value > 50 && price.Value < 60){
            await Task.Delay(TimeSpan.FromSeconds(40));
        }

        if (price.Value > 90 && price.Value < 95) {
            throw new Exception("Failure in product pricing service");
        }

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