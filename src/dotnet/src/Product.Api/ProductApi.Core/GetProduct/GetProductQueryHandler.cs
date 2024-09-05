// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core.GetProduct;

public class GetProductQueryHandler
{
    private readonly IProducts _products;

    public GetProductQueryHandler(IProducts products)
    {
        _products = products;
    }

    public async Task<HandlerResponse<ProductDto>> Handle(GetProductQuery query)
    {
        var product = await this._products.WithId(query.productId);

        if (product is null)
        {
            return new HandlerResponse<ProductDto>(null, false, new List<string>(1) { "Producty not found" });
        }

        return new HandlerResponse<ProductDto>(new ProductDto(product), true, new List<string>());
    }
}