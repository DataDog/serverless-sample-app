namespace ProductService.Api.Core;

public interface IEventPublisher
{
    Task Publish(ProductCreatedEvent evt);
    Task Publish(ProductDeletedEvent evt);
    Task Publish(ProductUpdatedEvent evt);
}