// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Microsoft.IdentityModel.Tokens;

namespace Orders.IntegrationTests;

public class ApiDriver
{
    private string apiEndpoint;
    private string productServiceApiEndpoint;
    private string secretKey;
    private HttpClient _httpClient;
    
    public ApiDriver(string env, AmazonSimpleSystemsManagementClient ssmClient)
    {
        _httpClient = new HttpClient();
        
        apiEndpoint = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/OrdersService/api-endpoint",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
        
        productServiceApiEndpoint = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/ProductManagementService/api-endpoint",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
        
        secretKey = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/shared/secret-access-key",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
    }

    public async Task<List<string>> LoadProductList()
    {
        var productResponse = await _httpClient.GetStringAsync($"{productServiceApiEndpoint}product");

        var products = JsonSerializer.Deserialize<ApiResponse<List<ProductDTO>>>(productResponse);

        return products.Data.Select(item => item.ProductId).ToList();
    }
    
    public async Task<HttpResponseMessage> CreateOrderFor(string[] products)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{apiEndpoint}/orders")
        {
            Content = new StringContent(JsonSerializer.Serialize(new { products }), Encoding.UTF8, "application/json")
        };

        var jwt = generateJwt();

        request.Headers.Add("Authorization", "Bearer " + jwt);
        
        return await _httpClient.SendAsync(request);
    }
    
    public async Task<HttpResponseMessage> GetOrderDetailsFor(string orderId)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"{apiEndpoint}/orders/{orderId}");

        var jwt = generateJwt();

        request.Headers.Add("Authorization", "Bearer " + jwt);
        
        return await _httpClient.SendAsync(request);
    }

    private string generateJwt()
    {
        var accountId = "test-user";
        var signingCredentials = new SigningCredentials(new SymmetricSecurityKey (Encoding.UTF8.GetBytes(secretKey)), SecurityAlgorithms.HmacSha256);
        JwtSecurityTokenHandler jwtSecurityTokenHandler = new();
            
        var userClaims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, accountId),
            new Claim("user_type", "Standard")
        };
            
        var userToken = jwtSecurityTokenHandler.WriteToken(
            new JwtSecurityToken(
                issuer: null,
                audience: null,
                userClaims,
                expires: DateTime.Now.AddMinutes(30),
                signingCredentials: signingCredentials
            )
        );

        return userToken;
    }
}