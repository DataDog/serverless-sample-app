using Microsoft.Extensions.DependencyInjection;

namespace ProductEventPublisher.Core;

public static class Startup
{
    public static IServiceCollection AddCore(this IServiceCollection services)
    {
        services.AddSingleton<EventAdapter>();
        return services;
    }
}