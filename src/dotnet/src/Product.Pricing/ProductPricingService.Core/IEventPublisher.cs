namespace ProductPricingService.Core;

public interface IEventPublisher
{
    Task Publish(ProductPricingUpdatedEvent evt);
}