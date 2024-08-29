using System.Text.Json;
using Amazon.SimpleNotificationService;
using Microsoft.Extensions.Configuration;
using ProductService.Api.Core;

namespace ProductService.Api.Adapters;

public class SnsEventPublisher(AmazonSimpleNotificationServiceClient snsClient, IConfiguration configuration)
    : IEventPublisher
{
    public async Task Publish(ProductCreatedEvent evt)
    {
        await snsClient.PublishAsync(configuration["PRODUCT_CREATED_TOPIC_ARN"], JsonSerializer.Serialize(evt));
    }

    public async Task Publish(ProductDeletedEvent evt)
    {
        await snsClient.PublishAsync(configuration["PRODUCT_DELETED_TOPIC_ARN"], JsonSerializer.Serialize(evt));
    }

    public async Task Publish(ProductUpdatedEvent evt)
    {
        await snsClient.PublishAsync(configuration["PRODUCT_UPDATED_TOPIC_ARN"], JsonSerializer.Serialize(evt));
    }
}