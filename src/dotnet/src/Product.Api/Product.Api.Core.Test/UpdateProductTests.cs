using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;
using Product.Api.Core.CreateProduct;
using Product.Api.Core.DeleteProduct;
using Product.Api.Core.UpdateProduct;

namespace Product.Api.Core.Test;

public class UpdateProductTests
{
    private IServiceProvider _serviceProvider;

    public UpdateProductTests()
    {
        var mockProductRepository = A.Fake<IProductRepository>();
        A.CallTo(() => mockProductRepository.GetProduct(A<String>.Ignored)).Returns(Product.From("12345", "test", 12));
        var mockEventPublisher = A.Fake<IEventPublisher>();
        
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddCore();
        serviceCollection.AddSingleton(mockProductRepository);
        serviceCollection.AddSingleton(mockEventPublisher);
        _serviceProvider = serviceCollection.BuildServiceProvider();
    }
    
    [Fact]
    public async Task UpdateProductCommand_WithValidInput_ShouldReturnSuccess()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProductRepository>();
        var mockEventPublisher = _serviceProvider.GetRequiredService<IEventPublisher>();
        var commandHandler = _serviceProvider.GetRequiredService<UpdateProductCommandHandler>();

        var response = await commandHandler.Handle(new UpdateProductCommand("12345", "new name", 15));
            
        A.CallTo(() => mockProductRepository.UpdateProduct(A<Product>.Ignored)).MustHaveHappened(1, Times.Exactly);
        A.CallTo(() => mockEventPublisher.Publish(A<ProductUpdatedEvent>.Ignored)).MustHaveHappened(1, Times.Exactly);
        Assert.True(response.IsSuccess);
    }
    
    [Fact]
    public async Task UpdateProductCommand_WithValidInputButNoChanges_ShouldReturnSuccess()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProductRepository>();
        var mockEventPublisher = _serviceProvider.GetRequiredService<IEventPublisher>();
        var commandHandler = _serviceProvider.GetRequiredService<UpdateProductCommandHandler>();

        var response = await commandHandler.Handle(new UpdateProductCommand("12345", "test", 12));
            
        A.CallTo(() => mockProductRepository.UpdateProduct(A<Product>.Ignored)).MustHaveHappened(0, Times.Exactly);
        A.CallTo(() => mockEventPublisher.Publish(A<ProductUpdatedEvent>.Ignored)).MustHaveHappened(0, Times.Exactly);
        Assert.True(response.IsSuccess);
    }
    
    [Fact]
    public async Task DeleteProductCommand_WithInvalidName_ShouldReturnErrors()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProductRepository>();
        var commandHandler = _serviceProvider.GetRequiredService<UpdateProductCommandHandler>();

        var response = await commandHandler.Handle(new UpdateProductCommand("", "", 0));
            
        Assert.Equal(5, response.Message.Count);
        Assert.False(response.IsSuccess);
        A.CallTo(() => mockProductRepository.UpdateProduct(A<Product>.Ignored)).MustHaveHappened(0, Times.Exactly);
    }
}