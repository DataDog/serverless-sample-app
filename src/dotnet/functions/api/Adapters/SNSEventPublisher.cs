using System.Text.Json;
using Amazon.SimpleNotificationService;
using Api.Core;
using Microsoft.Extensions.Configuration;

namespace Api.Adapters;

public class SnsEventPublisher(AmazonSimpleNotificationServiceClient snsClient, IConfiguration configuration)
    : IEventPublisher
{
    public async Task Publish(OrderCreatedEvent evt)
    {
        await snsClient.PublishAsync(configuration["SNS_TOPIC_ARN"], JsonSerializer.Serialize(evt));
    }
}