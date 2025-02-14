// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core.ListProducts;

public class ListProductsQueryHandler
{
    private readonly IProducts _products;

    public ListProductsQueryHandler(IProducts products)
    {
        _products = products;
    }

    public async Task<HandlerResponse<List<ProductDto>>> Handle(ListProductsQuery query)
    {
        var products = await this._products.All();

        if (products is null)
        {
            return new HandlerResponse<List<ProductDto>>(new List<ProductDto>(0), false, new List<string>(1) { "Producty not found" });
        }

        return new HandlerResponse<List<ProductDto>>(products.Select(p => new ProductDto(p)).ToList(), true, new List<string>());
    }
}