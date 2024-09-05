// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

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