using Microsoft.Extensions.DependencyInjection;

namespace Inventory.Acl.Core;

public static class Startup
{
    public static IServiceCollection AddCore(this IServiceCollection services)
    {
        services.AddSingleton<EventAdapter>();

        return services;
    }
    
}