using Amazon.Lambda.SQSEvents;
using FakeItEasy;
using Inventory.Acl.Adapters;
using Inventory.Acl.Core.InternalEvents;
using Microsoft.Extensions.DependencyInjection;

namespace Inventory.Acl.Core.Test;

public class InventoryAclTests
{
    private IServiceProvider _serviceProvider;

    public InventoryAclTests()
    {
        var mockEventPublisher = A.Fake<IInternalEventPublisher>();
        
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddCore();
        serviceCollection.AddSingleton(mockEventPublisher);
        _serviceProvider = serviceCollection.BuildServiceProvider();
    }
    
    [Fact]
    public async Task WithValidProductCreatedEvent_ShouldPublishInternalEvent()
    {
        var eventHandler = _serviceProvider.GetRequiredService<EventAdapter>();
        var eventPublisher = _serviceProvider.GetRequiredService<IInternalEventPublisher>();
        
        var function = new HandlerFunctions(eventHandler);
        await function.HandleCreated(new SQSEvent()
        {
            Records = new List<SQSEvent.SQSMessage>(1)
            {
                new()
                {
                    Body = "{\"detail\": {\"ProductId\":\"testid\"}}",
                    EventSourceArn = "aws:arn:eu-west-1:sqs:45235235:testqueue"
                }
            }
        });

        A.CallTo(() => eventPublisher.Publish(A<NewProductAddedEvent>
                .That
                .Matches(evt => evt.ProductId == "testid")))
            .MustHaveHappened(1, Times.Exactly);
    }
    
    [Fact]
    public async Task WithValidProductUpdatedEvent_ShouldPublishInternalEvent()
    {
        var eventHandler = _serviceProvider.GetRequiredService<EventAdapter>();
        var eventPublisher = _serviceProvider.GetRequiredService<IInternalEventPublisher>();

        var function = new HandlerFunctions(eventHandler);
        await function.HandleCreated(new SQSEvent()
        {
            Records = new List<SQSEvent.SQSMessage>(1)
            {
                new()
                {
                    Body = "{\"detail\": {\"ProductId\":\"testid\"}}",
                    EventSourceArn = "aws:arn:eu-west-1:sqs:45235235:testqueue"
                }
            }
        });

        A.CallTo(() => eventPublisher.Publish(A<NewProductAddedEvent>
                .That
                .Matches(evt => evt.ProductId == "testid")))
            .MustHaveHappened(1, Times.Exactly);
    }
}