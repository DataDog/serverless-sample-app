// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text;
using System.Text.Json;

namespace ProductApi.IntegrationTest;

public class ApiDriver
{
    private HttpClient _client = new();

    public async Task<string> CreateProduct(string name, decimal price)
    {
        var createOrderResult = await _client.PostAsync("https://z6ftvki1j1.execute-api.eu-west-1.amazonaws.com/prod/product",
            new StringContent(
                JsonSerializer.Serialize(new
                {
                    name,
                    price
                }), Encoding.UTF8, "application/json"
            ));

        var postBody = JsonDocument.Parse(await createOrderResult.Content.ReadAsStringAsync());
        var rootElement = postBody.RootElement;
        var dataProperty = rootElement.GetProperty("data");
        var productId = dataProperty.GetProperty("productId").ToString();

        return productId;
    }

    public async Task<bool> GetProduct(string productId)
    {
        var getProductResult =
            await _client.GetAsync($"https://z6ftvki1j1.execute-api.eu-west-1.amazonaws.com/prod/product/{productId}");
        
        return getProductResult.IsSuccessStatusCode;
    }

    public async Task UpdateProduct(string productId, string name, decimal price)
    {
        var updateProductResult = await _client.PutAsync("https://z6ftvki1j1.execute-api.eu-west-1.amazonaws.com/prod/product",
            new StringContent(
                JsonSerializer.Serialize(new
                {
                    id = productId,
                    name,
                    price
                }), Encoding.UTF8, "application/json"
            ));

        if (!updateProductResult.IsSuccessStatusCode)
        {
            throw new Exception("Failure updating product");
        }
    }

    public async Task<bool> DeleteProduct(string productId)
    {
        var getProductResult =
            await _client.DeleteAsync($"https://z6ftvki1j1.execute-api.eu-west-1.amazonaws.com/prod/product/{productId}");
        
        return getProductResult.IsSuccessStatusCode;
    }
}