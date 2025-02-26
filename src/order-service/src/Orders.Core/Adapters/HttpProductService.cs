// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.Extensions.Logging;

namespace Orders.Core.Adapters;

public class HttpProductService(HttpClient client, ILogger<HttpProductService> logger) : IProductService
{
    public async Task<bool> VerifyProductExists(string productId)
    {
        logger.LogInformation("Verifying product {ProductId} exists", productId);
        
        var response = await client.GetAsync($"/prod/product/{productId}");

        return response.IsSuccessStatusCode;
    }
}