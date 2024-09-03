using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;
using ProductApi.Core.UpdateProduct;

namespace ProductApi.Core.Test;

public class UpdateProductTests
{
    private IServiceProvider _serviceProvider;

    public UpdateProductTests()
    {
        var testProduct = Product.From(new ProductId("12345"), new ProductName("test"), new ProductPrice(12), new List<ProductPriceBracket>(1)
        {
            new(5, 10.99M)
        });
        
        var mockProductRepository = A.Fake<IProducts>();
        A.CallTo(() => mockProductRepository.WithId(A<String>.Ignored)).Returns(testProduct);
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
        var mockProductRepository = _serviceProvider.GetRequiredService<IProducts>();
        var mockEventPublisher = _serviceProvider.GetRequiredService<IEventPublisher>();
        var commandHandler = _serviceProvider.GetRequiredService<UpdateProductCommandHandler>();

        var response = await commandHandler.Handle(new UpdateProductCommand("12345", "new name", 15));
            
        A.CallTo(() => mockProductRepository.UpdateExistingFrom(A<Product>
            .That
            .Matches(product => product.PriceBrackets.Count == 0))).MustHaveHappened(1, Times.Exactly);
        A.CallTo(() => mockEventPublisher.Publish(A<ProductUpdatedEvent>.Ignored)).MustHaveHappened(1, Times.Exactly);
        Assert.True(response.IsSuccess);
    }
    
    [Fact]
    public async Task UpdateProductCommand_WithValidInputButNoChanges_ShouldReturnSuccess()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProducts>();
        var mockEventPublisher = _serviceProvider.GetRequiredService<IEventPublisher>();
        var commandHandler = _serviceProvider.GetRequiredService<UpdateProductCommandHandler>();

        var response = await commandHandler.Handle(new UpdateProductCommand("12345", "test", 12));
            
        A.CallTo(() => mockProductRepository.UpdateExistingFrom(A<Product>.Ignored)).MustHaveHappened(0, Times.Exactly);
        A.CallTo(() => mockEventPublisher.Publish(A<ProductUpdatedEvent>.Ignored)).MustHaveHappened(0, Times.Exactly);
        Assert.True(response.IsSuccess);
    }
    
    [Fact]
    public async Task UpdateProductCommand_WithInvalidName_ShouldReturnErrors()
    {
        var mockProductRepository = _serviceProvider.GetRequiredService<IProducts>();
        var commandHandler = _serviceProvider.GetRequiredService<UpdateProductCommandHandler>();

        var response = await commandHandler.Handle(new UpdateProductCommand("", "", 0));
            
        Assert.Equal(4, response.Message.Count);
        Assert.False(response.IsSuccess);
        A.CallTo(() => mockProductRepository.UpdateExistingFrom(A<Product>.Ignored)).MustHaveHappened(0, Times.Exactly);
    }
}