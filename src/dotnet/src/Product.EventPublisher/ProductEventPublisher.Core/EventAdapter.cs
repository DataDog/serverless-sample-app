using ProductEventPublisher.Core.ExternalEvents;
using ProductEventPublisher.Core.InternalEvents;

namespace ProductEventPublisher.Core;

public class EventAdapter(IExternalEventPublisher externalEventPublisher)
{
    public async Task HandleInternalEvent(ProductCreatedEvent evt)
    {
        await externalEventPublisher.Publish(new ProductCreatedEventV1()
        {
            ProductId = evt.ProductId
        });
    }
    public async Task HandleInternalEvent(ProductUpdatedEvent evt)
    {
        await externalEventPublisher.Publish(new ProductUpdatedEventV1()
        {
            ProductId = evt.ProductId
        });
    }
    public async Task HandleInternalEvent(ProductDeletedEvent evt)
    {
        await externalEventPublisher.Publish(new ProductDeletedEventV1()
        {
            ProductId = evt.ProductId
        });
    }
}