// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core.StockUpdated;

public class ProductStockUpdatedEventHandler(IProducts Products)
{
    public async Task Handle(ProductStockUpdatedEvent evt)
    {
        var product = await Products.WithId(evt.ProductId);

        if (product is null) return;

        product.UpdateStockLevels(evt.StockLevel);

        await Products.UpdateExistingFrom(product);
    }
}