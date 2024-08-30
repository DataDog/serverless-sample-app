using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;

namespace ProductPricingService.Core.Test;

public class ProductPricingTests
{
    private IServiceProvider _serviceProvider;
    private IEventPublisher _eventPublisher;

    public ProductPricingTests()
    {
        _eventPublisher = A.Fake<IEventPublisher>();
        
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddSingleton(_eventPublisher);
        serviceCollection.AddCore();
        _serviceProvider = serviceCollection.BuildServiceProvider();
    }
    
    [Fact]
    public async Task WithValidEvent_ShouldGeneratePricing()
    {
        var mockEventPublisher = _serviceProvider.GetRequiredService<IEventPublisher>();
        var pricingService = _serviceProvider.GetRequiredService<PricingService>();

        await pricingService.GeneratePricingFor(new ProductPrice(12));

        A.CallTo(() => mockEventPublisher.Publish(A<ProductPricingUpdatedEvent>
                .That
                .Matches(evt => evt.priceBrackets.Count == 5)))
            .MustHaveHappened(1, Times.Exactly);
    }
}