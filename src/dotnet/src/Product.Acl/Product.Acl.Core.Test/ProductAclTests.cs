// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.Lambda.SQSEvents;
using FakeItEasy;
using Microsoft.Extensions.DependencyInjection;
using Product.Acl.Adapters;
using Product.Acl.Core.InternalEvents;

namespace Product.Acl.Core.Test;

public class ProductAclTests
{
    private IServiceProvider _serviceProvider;

    public ProductAclTests()
    {
        var mockEventPublisher = A.Fake<IInternalEventPublisher>();
        
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddCore();
        serviceCollection.AddSingleton(mockEventPublisher);
        _serviceProvider = serviceCollection.BuildServiceProvider();
    }
    
    [Fact]
    public async Task WithValidStockUpdatedEvent_ShouldPublishInternalEvent()
    {
        var eventHandler = _serviceProvider.GetRequiredService<EventAdapter>();
        var eventPublisher = _serviceProvider.GetRequiredService<IInternalEventPublisher>();
        
        var function = new HandlerFunctions(eventHandler);
        await function.HandleInventoryStockUpdate(new SQSEvent()
        {
            Records = new List<SQSEvent.SQSMessage>(1)
            {
                new()
                {
                    Body = "{\"detail\": {\"ProductId\":\"testid\", \"NewStockLevel\": 10, \"PreviousStockLevel\": 5}}",
                    EventSourceArn = "aws:arn:eu-west-1:sqs:45235235:testqueue"
                }
            }
        });

        A.CallTo(() => eventPublisher.Publish(A<ProductStockUpdated>
                .That
                .Matches(evt => evt.ProductId == "testid" && evt.StockLevel == 10)))
            .MustHaveHappened(1, Times.Exactly);
    }
}