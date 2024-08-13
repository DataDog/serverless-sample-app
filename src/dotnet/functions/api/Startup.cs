using Amazon.DynamoDBv2;
using Amazon.SimpleNotificationService;
using Api.Adapters;
using Api.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Api;

[Amazon.Lambda.Annotations.LambdaStartup]
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        var configuration = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .Build();

        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();

        services.AddSingleton(new AmazonSimpleNotificationServiceClient());
        services.AddSingleton(new AmazonDynamoDBClient());

        services.AddSingleton<IEventPublisher, SnsEventPublisher>();
        services.AddSingleton<IOrderRepository, DynamoDbOrderRepository>();
    }
}
