using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;
using ProductEventPublisher.Core.ExternalEvents;
using ProductEventPublisher.Core.InternalEvents;

namespace ProductEventPublisher.Core.Tests;

public class EventAdapterTests
{
    private IServiceProvider _serviceProvider;

    public EventAdapterTests()
    {
        var mockEventPublisher = A.Fake<IExternalEventPublisher>();
        
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddCore();
        serviceCollection.AddSingleton(mockEventPublisher);
        _serviceProvider = serviceCollection.BuildServiceProvider();
    }
    
    [Fact]
    public async Task OnValidCreatedEvent_ShouldPublishEvent()
    {
        var eventAdapter = _serviceProvider.GetRequiredService<EventAdapter>();
        var mockPublisher = _serviceProvider.GetRequiredService<IExternalEventPublisher>();

        await eventAdapter.HandleInternalEvent(new ProductCreatedEvent()
        {
            ProductId = "testid",
            Price = 10.9M
        });

        A.CallTo(() => mockPublisher.Publish(A<ProductCreatedEventV1>
            .That
            .Matches(evt => evt.ProductId == "testid")))
            .MustHaveHappened(1, Times.Exactly);

    }
    
    [Fact]
    public async Task OnValidUpdatedEvent_ShouldPublishEvent()
    {
        var eventAdapter = _serviceProvider.GetRequiredService<EventAdapter>();
        var mockPublisher = _serviceProvider.GetRequiredService<IExternalEventPublisher>();

        await eventAdapter.HandleInternalEvent(new ProductUpdatedEvent()
        {
            ProductId = "testid"
        });

        A.CallTo(() => mockPublisher.Publish(A<ProductUpdatedEventV1>
                .That
                .Matches(evt => evt.ProductId == "testid")))
            .MustHaveHappened(1, Times.Exactly);

    }
    
    [Fact]
    public async Task OnValidDeletedEvent_ShouldPublishEvent()
    {
        var eventAdapter = _serviceProvider.GetRequiredService<EventAdapter>();
        var mockPublisher = _serviceProvider.GetRequiredService<IExternalEventPublisher>();

        await eventAdapter.HandleInternalEvent(new ProductDeletedEvent()
        {
            ProductId = "testid",
        });

        A.CallTo(() => mockPublisher.Publish(A<ProductDeletedEventV1>
                .That
                .Matches(evt => evt.ProductId == "testid")))
            .MustHaveHappened(1, Times.Exactly);

    }
}