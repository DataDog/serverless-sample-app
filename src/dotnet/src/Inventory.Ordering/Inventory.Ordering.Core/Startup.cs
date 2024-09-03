using Inventory.Ordering.Core.NewProductAdded;
using Microsoft.Extensions.DependencyInjection;

namespace Inventory.Ordering.Core;

public static class Startup
{
    public static IServiceCollection AddCore(this IServiceCollection services)
    {
        services.AddSingleton<NewProductAddedEventHandler>();

        return services;
    }
}