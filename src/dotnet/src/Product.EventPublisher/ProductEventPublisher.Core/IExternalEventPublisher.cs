using ProductEventPublisher.Core.ExternalEvents;

namespace ProductEventPublisher.Core;

public interface IExternalEventPublisher
{
    Task Publish(ProductCreatedEventV1 evt);
    Task Publish(ProductUpdatedEventV1 evt);
    Task Publish(ProductDeletedEventV1 evt);
}