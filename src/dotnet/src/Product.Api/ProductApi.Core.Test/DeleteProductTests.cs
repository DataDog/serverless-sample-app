// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;
using ProductApi.Core.DeleteProduct;

namespace ProductApi.Core.Test;

public class DeleteProductTests
{
    private IServiceProvider _serviceProvider;

    public DeleteProductTests()
    {
        var mockProductRepository = A.Fake<IProducts>();
        var mockEventPublisher = A.Fake<IEventPublisher>();
        
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddCore();
        serviceCollection.AddSingleton(mockProductRepository);
        serviceCollection.AddSingleton(mockEventPublisher);
        _serviceProvider = serviceCollection.BuildServiceProvider();
    }
    
    [Fact]
    public async Task DeleteProductCommand_WithValidInput_ShouldReturnSuccess()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProducts>();
        var commandHandler = _serviceProvider.GetRequiredService<DeleteProductCommandHandler>();

        var response = await commandHandler.Handle(new DeleteProductCommand("12345"));
            
        A.CallTo(() => mockProductRepository.RemoveWithId(A<String>.Ignored)).MustHaveHappened(1, Times.Exactly);
        Assert.True(response.IsSuccess);
    }
}