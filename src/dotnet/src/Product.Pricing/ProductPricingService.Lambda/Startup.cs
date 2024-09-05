// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.Lambda.Annotations;
using Amazon.SimpleNotificationService;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ProductPricingService.Core;
using ProductPricingService.Lambda.Adapters;
using StatsdClient;

namespace ProductPricingService.Lambda;

[LambdaStartup]
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

        services.AddSingleton<IEventPublisher, SnsEventPublisher>();
        services.AddCore();
    }
}