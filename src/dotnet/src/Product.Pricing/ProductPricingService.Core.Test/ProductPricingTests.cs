using Amazon.Lambda.SNSEvents;
using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;
using NJsonSchema;
using ProductPricingService.Lambda;

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
    public async Task WithValidCreatedEvent_ShouldGeneratePricing()
    {
        var testSchema = await File.ReadAllTextAsync("./schemas/productCreated.expected.json");
        var expectedEventJsonSchema = await JsonSchema.FromJsonAsync(testSchema);
        var sampleEventJson = expectedEventJsonSchema.ToSampleJson().ToString();
        
        var mockEventPublisher = _serviceProvider.GetRequiredService<IEventPublisher>();
        var pricingService = _serviceProvider.GetRequiredService<PricingService>();

        var handler = new Functions(pricingService);
        await handler.HandleProductCreated(new SNSEvent()
        {
            Records = new List<SNSEvent.SNSRecord>(1)
            {
                new()
                {
                    Sns = new SNSEvent.SNSMessage()
                    {
                        Message = sampleEventJson
                    }
                }
            }
        });

        A.CallTo(() => mockEventPublisher.Publish(A<ProductPricingUpdatedEvent>
                .That
                .Matches(evt => evt.PriceBrackets.Count == 5)))
            .MustHaveHappened(1, Times.Exactly);
    }
    
    [Fact]
    public async Task WithValidUpdatedEvent_ShouldGeneratePricing()
    {
        var testSchema = await File.ReadAllTextAsync("./schemas/productUpdated.expected.json");
        var expectedEventJsonSchema = await JsonSchema.FromJsonAsync(testSchema);
        var sampleEventJson = expectedEventJsonSchema.ToSampleJson().ToString();
        
        var mockEventPublisher = _serviceProvider.GetRequiredService<IEventPublisher>();
        var pricingService = _serviceProvider.GetRequiredService<PricingService>();

        var handler = new Functions(pricingService);
        await handler.HandleProductUpdated(new SNSEvent()
        {
            Records = new List<SNSEvent.SNSRecord>(1)
            {
                new()
                {
                    Sns = new SNSEvent.SNSMessage()
                    {
                        Message = sampleEventJson
                    }
                }
            }
        });

        A.CallTo(() => mockEventPublisher.Publish(A<ProductPricingUpdatedEvent>
                .That
                .Matches(evt => evt.PriceBrackets.Count == 5)))
            .MustHaveHappened(1, Times.Exactly);
    }
}