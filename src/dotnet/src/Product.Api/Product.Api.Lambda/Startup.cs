using Amazon.DynamoDBv2;
using Amazon.SimpleNotificationService;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Product.Api.Adapters;
using Product.Api.Core;

namespace Product.Api;

[Amazon.Lambda.Annotations.LambdaStartup]
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        var configuration = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .Build();

        services.AddSingleton<IConfiguration>(configuration);
        services.AddCore();
        services.AddLogging();

        services.AddSingleton(new AmazonSimpleNotificationServiceClient());
        services.AddSingleton(new AmazonDynamoDBClient());

        services.AddSingleton<IEventPublisher, SnsEventPublisher>();
        services.AddSingleton<IProductRepository, DynamoDbProductRepository>();
    }
}
