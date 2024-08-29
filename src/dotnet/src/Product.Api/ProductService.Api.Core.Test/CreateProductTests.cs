using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;
using ProductService.Api.Core.CreateProduct;

namespace ProductService.Api.Core.Test;

public class CreateProductTests
{
    private IServiceProvider _serviceProvider;

    public CreateProductTests()
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
    public async Task CreateProductCommand_WithValidInput_ShouldReturnSuccess()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProducts>();
        var commandHandler = _serviceProvider.GetRequiredService<CreateProductCommandHandler>();

        var response = await commandHandler.Handle(new CreateProductCommand("test", 100));
            
        A.CallTo(() => mockProductRepository.AddNew(A<Product>.Ignored)).MustHaveHappened(1, Times.Exactly);
        Assert.True(response.IsSuccess);
    }
    
    [Fact]
    public async Task CreateProductCommand_WithInvalidName_ShouldReturnErrors()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProducts>();
        var commandHandler = _serviceProvider.GetRequiredService<CreateProductCommandHandler>();

        var response = await commandHandler.Handle(new CreateProductCommand("", 100));
            
        Assert.NotEmpty(response.Message);
        Assert.False(response.IsSuccess);
        A.CallTo(() => mockProductRepository.AddNew(A<Product>.Ignored)).MustHaveHappened(0, Times.Exactly);
    }
    
    [Fact]
    public async Task CreateProductCommand_WithInvalidPrice_ShouldReturnErrors()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProducts>();
        var commandHandler = _serviceProvider.GetRequiredService<CreateProductCommandHandler>();

        var response = await commandHandler.Handle(new CreateProductCommand("Test name", 0));
            
        Assert.NotEmpty(response.Message);
        Assert.False(response.IsSuccess);
        A.CallTo(() => mockProductRepository.AddNew(A<Product>.Ignored)).MustHaveHappened(0, Times.Exactly);
    }
}