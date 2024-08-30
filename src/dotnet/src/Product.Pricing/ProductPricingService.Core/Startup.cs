using Microsoft.Extensions.DependencyInjection;

namespace ProductPricingService.Core;

public static class Startup
{
    public static IServiceCollection AddCore(this IServiceCollection services)
    {
        services.AddSingleton<PricingService>();

        return services;
    }
}