// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Microsoft.IdentityModel.Tokens;
using Xunit.Abstractions;

namespace Orders.IntegrationTests;

public class ApiDriver
{
    private readonly ITestOutputHelper _testOutputHelper;
    private string env;
    private string testHarnessApiEndpoint;
    private string apiEndpoint;
    private string secretKey;
    private string eventBusName;
    private HttpClient _httpClient;
    private AmazonEventBridgeClient _eventBridgeClient;
    
    public ApiDriver(ITestOutputHelper testOutputHelper, string env, AmazonSimpleSystemsManagementClient ssmClient)
    {
        _testOutputHelper = testOutputHelper;
        this.env = env;
        _httpClient = new HttpClient();
        _eventBridgeClient = new AmazonEventBridgeClient();
        string serviceName = env == "dev" || env == "prod" ? "shared" : "OrdersService";
        
        apiEndpoint = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/OrdersService/api-endpoint",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
        
        testHarnessApiEndpoint = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/OrdersService_TestHarness/api-endpoint",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
        
        secretKey = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/{serviceName}/secret-access-key",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
        
        eventBusName = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/{serviceName}/event-bus-name",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
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

    public async Task StockReservationSuccessfulFor(string orderId)
    {
        var testEventApiEndpoint = $"{testHarnessApiEndpoint}/events/{orderId}";
        _testOutputHelper.WriteLine($"Test harness endpoint is: {testEventApiEndpoint}");
        
        await Task.Delay(TimeSpan.FromSeconds(10));
        
        var request = new HttpRequestMessage(HttpMethod.Get, testEventApiEndpoint);
        
        var eventResult = await _httpClient.SendAsync(request);
        var responseString = await eventResult.Content.ReadAsStringAsync();
        
        _testOutputHelper.WriteLine(responseString);

        var events = JsonSerializer.Deserialize<List<ReceivedEvent>>(responseString);
        
        if (!events.Any())
        {
            throw new Exception($"No events received for order {orderId}");
        }

        var stockReservedEvent = events.FirstOrDefault();

        await _eventBridgeClient.PutEventsAsync(new PutEventsRequest()
        {
            Entries = new List<PutEventsRequestEntry>(1)
            {
                new()
                {
                    EventBusName = eventBusName,
                    Source = $"{this.env}.inventory",
                    DetailType = "inventory.stockReserved.v1",
                    Detail = "{\"conversationId\":\"" + stockReservedEvent.ConversationId + "\"}"
                }
            }
        });

        await Task.Delay(TimeSpan.FromSeconds(5));
    }
    
    

    public async Task StockReservationFailedFor(string orderId)
    {
        var testEventApiEndpoint = $"{testHarnessApiEndpoint}/events/{orderId}";
        _testOutputHelper.WriteLine($"Test harness endpoint is: {testEventApiEndpoint}");
        
        await Task.Delay(TimeSpan.FromSeconds(10));
        
        var request = new HttpRequestMessage(HttpMethod.Get, testEventApiEndpoint);
        
        var eventResult = await _httpClient.SendAsync(request);
        var responseString = await eventResult.Content.ReadAsStringAsync();
        
        _testOutputHelper.WriteLine(responseString);

        var events = JsonSerializer.Deserialize<List<ReceivedEvent>>(responseString);
        
        if (!events.Any())
        {
            throw new Exception($"No events received for order {orderId}");
        }

        var stockReservedEvent = events.FirstOrDefault();

        await _eventBridgeClient.PutEventsAsync(new PutEventsRequest()
        {
            Entries = new List<PutEventsRequestEntry>(1)
            {
                new()
                {
                    EventBusName = eventBusName,
                    Source = $"{this.env}.inventory",
                    DetailType = "inventory.stockReservationFailed.v1",
                    Detail = "{\"conversationId\":\"" + stockReservedEvent.ConversationId + "\"}"
                }
            }
        });

        await Task.Delay(TimeSpan.FromSeconds(5));
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
        
        _testOutputHelper.WriteLine($"Generated JWT: {userToken}");

        return userToken;
    }
}