using Microsoft.Extensions.DependencyInjection;
using ProductService.Api.Core.CreateProduct;
using ProductService.Api.Core.DeleteProduct;
using ProductService.Api.Core.GetProduct;
using ProductService.Api.Core.UpdateProduct;

namespace ProductService.Api.Core;

public static class Startup
{
    public static IServiceCollection AddCore(this IServiceCollection services)
    {
        services.AddSingleton<CreateProductCommandHandler>();
        services.AddSingleton<DeleteProductCommandHandler>();
        services.AddSingleton<UpdateProductCommandHandler>();
        services.AddSingleton<GetProductQueryHandler>();

        return services;
    }
}