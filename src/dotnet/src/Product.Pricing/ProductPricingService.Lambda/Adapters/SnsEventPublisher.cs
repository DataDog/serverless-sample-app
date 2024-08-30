using System.Text.Json;
using Amazon.SimpleNotificationService;
using Microsoft.Extensions.Configuration;
using ProductPricingService.Core;

namespace ProductPricingService.Lambda.Adapters;

public class SnsEventPublisher : IEventPublisher
{
    private readonly AmazonSimpleNotificationServiceClient snsClient;
    private readonly IConfiguration configuration;

    public SnsEventPublisher(AmazonSimpleNotificationServiceClient snsClient, IConfiguration configuration)
    {
        this.configuration = configuration;
        this.snsClient = snsClient;
    }

    public async Task Publish(ProductPricingUpdatedEvent evt)
    {
        await snsClient.PublishAsync(configuration["PRICE_CALCULATED_TOPIC_ARN"], JsonSerializer.Serialize(evt));
    }
}