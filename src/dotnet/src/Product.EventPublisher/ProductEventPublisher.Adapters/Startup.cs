using Amazon.EventBridge;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ProductEventPublisher.Core;
using StatsdClient;

namespace ProductEventPublisher.Adapters;

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
        services.AddSingleton(new AmazonEventBridgeClient());
        services.AddSingleton<IExternalEventPublisher, EventBridgeExternalEventPublisher>();
    }
}
