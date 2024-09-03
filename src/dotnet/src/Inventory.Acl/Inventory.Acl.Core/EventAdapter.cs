using Inventory.Acl.Core.ExternalEvents;
using Inventory.Acl.Core.InternalEvents;

namespace Inventory.Acl.Core;

public class EventAdapter(IInternalEventPublisher publisher)
{
    public async Task Handle(ProductCreatedEventV1 evt)
    {
        await publisher.Publish(new NewProductAddedEvent()
        {
            ProductId = evt.ProductId
        });
    }
    
    public async Task Handle(ProductUpdatedEventV1 evt)
    {
        await publisher.Publish(new NewProductAddedEvent()
        {
            ProductId = evt.ProductId
        });
    }
}