// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using FakeItEasy;
using Inventory.Ordering.Core.NewProductAdded;
using Microsoft.Extensions.DependencyInjection;

namespace Inventory.Ordering.Core.Test;

public class InventoryOrderingWorkflowTest
{
    private IServiceProvider _serviceProvider;

    public InventoryOrderingWorkflowTest()
    {
        var mockEventPublisher = A.Fake<IOrderWorkflowEngine>();
        
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddCore();
        serviceCollection.AddSingleton(mockEventPublisher);
        _serviceProvider = serviceCollection.BuildServiceProvider();
    }
    
    [Fact]
    public async Task WithValidEventInput_ShouldStartWorkflow()
    {
        var eventHandler = _serviceProvider.GetRequiredService<NewProductAddedEventHandler>();
        var workflowEngine = _serviceProvider.GetRequiredService<IOrderWorkflowEngine>();

        await eventHandler.Handle(new NewProductAddedEvent()
        {
            ProductId = "testid"
        });

        A.CallTo(() => workflowEngine.StartWorkflowFor(A<string>
                .That
                .Matches(productId => productId == "testid")))
            .MustHaveHappened(1, Times.Exactly);
    }
}