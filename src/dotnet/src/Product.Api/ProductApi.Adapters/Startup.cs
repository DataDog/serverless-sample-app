using Amazon.DynamoDBv2;
using Amazon.SimpleNotificationService;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ProductApi.Adapters.Adapters;
using ProductApi.Core;
using StatsdClient;

namespace ProductApi.Adapters;

[Amazon.Lambda.Annotations.LambdaStartup]
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        var dogstatsdConfig = new StatsdConfig
        {
            StatsdServerName = "127.0.0.1",
            StatsdPort = 8125,
        };

        DogStatsd.Configure(dogstatsdConfig);
        
        var configuration = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .Build();

        services.AddSingleton<IConfiguration>(configuration);
        services.AddCore();
        services.AddLogging();

        services.AddSingleton(new AmazonSimpleNotificationServiceClient());
        services.AddSingleton(new AmazonDynamoDBClient());

        services.AddSingleton<IEventPublisher, SnsEventPublisher>();
        services.AddSingleton<IProducts, DynamoDbProducts>();
    }
}
