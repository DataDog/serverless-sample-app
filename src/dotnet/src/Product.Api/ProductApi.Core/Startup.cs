// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Microsoft.Extensions.DependencyInjection;
using ProductApi.Core.CreateProduct;
using ProductApi.Core.DeleteProduct;
using ProductApi.Core.GetProduct;
using ProductApi.Core.PricingChanged;
using ProductApi.Core.UpdateProduct;

namespace ProductApi.Core;

public static class Startup
{
    public static IServiceCollection AddCore(this IServiceCollection services)
    {
        services.AddSingleton<CreateProductCommandHandler>();
        services.AddSingleton<DeleteProductCommandHandler>();
        services.AddSingleton<UpdateProductCommandHandler>();
        services.AddSingleton<GetProductQueryHandler>();
        services.AddSingleton<PricingUpdatedEventHandler>();

        return services;
    }
}