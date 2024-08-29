using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;
using Product.Api.Core.DeleteProduct;

namespace Product.Api.Core.Test;

public class DeleteProductTests
{
    private IServiceProvider _serviceProvider;

    public DeleteProductTests()
    {
        var mockProductRepository = A.Fake<IProductRepository>();
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
        var mockProductRepository = _serviceProvider.GetRequiredService<IProductRepository>();
        var commandHandler = _serviceProvider.GetRequiredService<DeleteProductCommandHandler>();

        var response = await commandHandler.Handle(new DeleteProductCommand("12345"));
            
        A.CallTo(() => mockProductRepository.DeleteProduct(A<String>.Ignored)).MustHaveHappened(1, Times.Exactly);
        Assert.True(response.IsSuccess);
    }
    
    [Fact]
    public async Task DeleteProductCommand_WithInvalidName_ShouldReturnErrors()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProductRepository>();
        var commandHandler = _serviceProvider.GetRequiredService<DeleteProductCommandHandler>();

        var response = await commandHandler.Handle(new DeleteProductCommand(""));
            
        Assert.NotEmpty(response.Message);
        Assert.False(response.IsSuccess);
        A.CallTo(() => mockProductRepository.DeleteProduct(A<String>.Ignored)).MustHaveHappened(0, Times.Exactly);
    }
}