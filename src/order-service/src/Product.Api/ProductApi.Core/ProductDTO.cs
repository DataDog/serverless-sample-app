// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json.Serialization;

namespace ProductApi.Core;

public class ProductDto(Product product)
{
    [JsonPropertyName("productId")] public string ProductId { get; set; } = product.ProductId;

    [JsonPropertyName("name")] public string Name { get; set; } = product.Details.Name;

    [JsonPropertyName("price")] public decimal Price { get; set; } = product.Details.Price;

    [JsonPropertyName("pricingBrackets")]
    public List<ProductPriceBracket> PriceBrackets { get; set; } = product.PriceBrackets;

    [JsonPropertyName("currentStockLevel")]
    public int CurrentStockLevel { get; set; } = product.CurrentStockLevel;
}