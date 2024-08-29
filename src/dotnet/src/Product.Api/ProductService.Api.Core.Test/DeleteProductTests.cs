using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;
using ProductService.Api.Core.DeleteProduct;

namespace ProductService.Api.Core.Test;

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