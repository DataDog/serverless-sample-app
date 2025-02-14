// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text;
using System.Text.Json;
using NJsonSchema;

namespace ProductApi.IntegrationTest;

public class ProductTests
{
    private ApiDriver _apiDriver = new();
    private EventValidator _validator = new();
    
    [Fact]
    public async Task CreateProduct_ShouldRetrieveAndEventPublished()
    {
        var productId = await _apiDriver.CreateProduct("Test Product", 10.0m);

        var getProductResult = await _apiDriver.GetProduct(productId);

        Assert.True(getProductResult);
        
        await _validator.Validate(productId, 1, "DotnetProductCreatedTopic", "./expected_schemas/product_created_event_v1.json");
    }
    
    [Fact]
    public async Task CreateAndUpdateProduct_ShouldPublishEvent()
    {
        var productId = await _apiDriver.CreateProduct("Test Product", 10.0m);
        
        await _apiDriver.UpdateProduct(productId, "Updated Product", 20.0m);
        
        await _validator.Validate(productId, 2, "DotnetProductUpdatedTopic", "./expected_schemas/product_updated_event_v1.json");
    }
    
    [Fact]
    public async Task OnDelete_ShouldPublishEvent()
    {
        var productId = await _apiDriver.CreateProduct("Test Product", 10.0m);
        
        await _apiDriver.DeleteProduct(productId);
        
        await _validator.Validate(productId, 2, "DotnetProductDeletedTopic", "./expected_schemas/product_deleted_event_v1.json");
    }
}

public record ReceivedEvent
{
    public string Key { get; set; }

    public string EventData { get; set; }

    public DateTime ReceivedOn { get; set; }

    public string ReceivedFrom { get; set; }
}