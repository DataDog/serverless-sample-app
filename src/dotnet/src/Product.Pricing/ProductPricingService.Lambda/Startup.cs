using Amazon.Lambda.Annotations;
using Amazon.SimpleNotificationService;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ProductPricingService.Core;
using ProductPricingService.Lambda.Adapters;

namespace ProductPricingService.Lambda;

[LambdaStartup]
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

        services.AddSingleton<IEventPublisher, SnsEventPublisher>();
        services.AddCore();
    }
}