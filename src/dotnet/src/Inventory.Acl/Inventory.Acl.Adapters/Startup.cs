using Amazon.SimpleNotificationService;
using Inventory.Acl.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StatsdClient;

namespace Inventory.Acl.Adapters;

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

        services.AddSingleton<IInternalEventPublisher, SnsEventPublisher>();
    }
}
