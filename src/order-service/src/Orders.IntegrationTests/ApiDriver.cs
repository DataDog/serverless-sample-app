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
using CloudNative.CloudEvents.SystemTextJson;
using Microsoft.IdentityModel.Tokens;
using Orders.Core.Adapters;
using Xunit.Abstractions;

namespace Orders.IntegrationTests;

public class ApiDriver
{
    private readonly ITestOutputHelper _testOutputHelper;
    private readonly string _env;
    private readonly string _testHarnessApiEndpoint;
    private readonly string _apiEndpoint;
    private readonly string _secretKey;
    private readonly string _eventBusName;
    private HttpClient _httpClient;
    private AmazonEventBridgeClient _eventBridgeClient;
    
    public ApiDriver(ITestOutputHelper testOutputHelper, string env, AmazonSimpleSystemsManagementClient ssmClient)
    {
        _testOutputHelper = testOutputHelper;
        this._env = env;
        _httpClient = new HttpClient();
        _eventBridgeClient = new AmazonEventBridgeClient();
        string serviceName = env == "dev" || env == "prod" ? "shared" : "OrdersService";
        
        _apiEndpoint = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/OrdersService/api-endpoint",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
        
        _testHarnessApiEndpoint = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/OrdersService_TestHarness/api-endpoint",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
        
        _secretKey = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/{serviceName}/secret-access-key",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
        
        _eventBusName = ssmClient.GetParameterAsync(new GetParameterRequest
        {
            Name = $"/{env}/{serviceName}/event-bus-name",
            WithDecryption = true
        }).GetAwaiter().GetResult().Parameter.Value;
    }
    
    public async Task<HttpResponseMessage> CreateOrderFor(string[] products)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"{_apiEndpoint}/orders")
        {
            Content = new StringContent(JsonSerializer.Serialize(new { products }), Encoding.UTF8, "application/json")
        };

        var jwt = GenerateJwt();

        request.Headers.Add("Authorization", "Bearer " + jwt);
        
        return await _httpClient.SendAsync(request);
    }
    
    public async Task<HttpResponseMessage> GetOrderDetailsFor(string orderId)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"{_apiEndpoint}/orders/{orderId}");

        var jwt = GenerateJwt();

        request.Headers.Add("Authorization", "Bearer " + jwt);
        
        return await _httpClient.SendAsync(request);
    }

    public async Task StockReservationSuccessfulFor(string orderId)
    {
        var testEventApiEndpoint = $"{_testHarnessApiEndpoint}/events/{orderId}";
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

        var putRequestEntry = new PutEventsRequestEntry()
        {
            EventBusName = _eventBusName,
            Source = $"{this._env}.inventory",
            DetailType = "inventory.stockReserved.v1",
            Detail = "{\"conversationId\":\"" + stockReservedEvent.ConversationId + "\"}"
        };
        var cloudEvent = putRequestEntry.GenerateCloudEventFrom();
        var evtFormatter = new JsonEventFormatter();
        if (cloudEvent != null)
        {
            putRequestEntry.Detail = evtFormatter.ConvertToJsonElement(cloudEvent).ToString();
        }
        
        _testOutputHelper.WriteLine($"Sending event: {JsonSerializer.Serialize(putRequestEntry)}");

        await _eventBridgeClient.PutEventsAsync(new PutEventsRequest()
        {
            Entries = new List<PutEventsRequestEntry>(1)
            {
                putRequestEntry
            }
        });

        await Task.Delay(TimeSpan.FromSeconds(10));
    }
    
    public async Task StockReservationFailedFor(string orderId)
    {
        var testEventApiEndpoint = $"{_testHarnessApiEndpoint}/events/{orderId}";
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

        var reservationFailedEvent = events.FirstOrDefault();
        
        var putRequestEntry = new PutEventsRequestEntry()
        {
            EventBusName = _eventBusName,
            Source = $"{this._env}.inventory",
            DetailType = "inventory.stockReservationFailed.v1",
            Detail = "{\"conversationId\":\"" + reservationFailedEvent.ConversationId + "\"}"
        };
        var cloudEvent = putRequestEntry.GenerateCloudEventFrom();
        var evtFormatter = new JsonEventFormatter();
        if (cloudEvent != null)
        {
            putRequestEntry.Detail = evtFormatter.ConvertToJsonElement(cloudEvent).ToString();
        }
        
        _testOutputHelper.WriteLine($"Sending event: {JsonSerializer.Serialize(putRequestEntry)}");

        await _eventBridgeClient.PutEventsAsync(new PutEventsRequest()
        {
            Entries = new List<PutEventsRequestEntry>(1)
            {
                putRequestEntry
            }
        });

        await Task.Delay(TimeSpan.FromSeconds(10));
    }

    public async Task<bool> VerifyOrderConfirmedEventPublishedFor(string orderId)
    {
        var testEventApiEndpoint = $"{_testHarnessApiEndpoint}/events/{orderId}";
        _testOutputHelper.WriteLine($"Test harness endpoint is: {testEventApiEndpoint}");
        
        await Task.Delay(TimeSpan.FromSeconds(10));
        
        var request = new HttpRequestMessage(HttpMethod.Get, testEventApiEndpoint);
        
        var eventResult = await _httpClient.SendAsync(request);
        var responseString = await eventResult.Content.ReadAsStringAsync();

        var events = JsonSerializer.Deserialize<List<ReceivedEvent>>(responseString);
        
        if (!events.Any())
        {
            throw new Exception($"No events received for order {orderId}");
        }
        
        var orderConfirmedEvent = events.FirstOrDefault(evt => evt.EventType == "orders.orderConfirmed.v1");
        
        return orderConfirmedEvent != null;
    }
    
    private string GenerateJwt()
    {
        var accountId = "test-user";
        var signingCredentials = new SigningCredentials(new SymmetricSecurityKey (Encoding.UTF8.GetBytes(_secretKey)), SecurityAlgorithms.HmacSha256);
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