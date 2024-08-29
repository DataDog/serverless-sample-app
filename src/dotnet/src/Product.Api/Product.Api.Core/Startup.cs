using Microsoft.Extensions.DependencyInjection;
using Product.Api.Core.CreateProduct;
using Product.Api.Core.DeleteProduct;
using Product.Api.Core.GetProduct;
using Product.Api.Core.UpdateProduct;

namespace Product.Api.Core;

public static class Startup
{
    public static IServiceCollection AddCore(this IServiceCollection services)
    {
        services.AddSingleton(new CreateProductValidator());
        services.AddSingleton<CreateProductCommandHandler>();
        
        services.AddSingleton(new DeleteProductValidator());
        services.AddSingleton<DeleteProductCommandHandler>();
        
        services.AddSingleton(new UpdateProductValidator());
        services.AddSingleton<UpdateProductCommandHandler>();
        
        services.AddSingleton<GetProductQueryHandler>();

        return services;
    }
}