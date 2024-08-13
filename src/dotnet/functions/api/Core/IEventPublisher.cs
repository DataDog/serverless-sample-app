namespace Api.Core;

public interface IEventPublisher
{
    Task Publish(OrderCreatedEvent evt);
}