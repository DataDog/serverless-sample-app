using Inventory.Acl.Core.InternalEvents;

namespace Inventory.Acl.Core;

public interface IInternalEventPublisher
{
    Task Publish(NewProductAddedEvent evt);
}