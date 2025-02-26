// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using Amazon.Lambda.Annotations;
using Amazon.SimpleNotificationService;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Orders.BackgroundWorkers.ExternalEvents;
using Orders.Core;
using Orders.Core.Adapters;
using StatsdClient;

namespace Orders.BackgroundWorkers;

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
        
        var eventBridgeClient = new AmazonEventBridgeClient();
        eventBridgeClient.DescribeEventBusAsync(new DescribeEventBusRequest()
        {
            Name = configuration["EVENT_BUS_NAME"]
        }).GetAwaiter().GetResult();
        services.AddSingleton(eventBridgeClient);

        services.AddSingleton<IConfiguration>(configuration);
        services.AddCore(configuration);;
        services.AddLogging();

        services.AddSingleton<IPublicEventPublisher, EventBridgeEventPublisher>();
        services.AddSingleton<EventGateway>();
    }
}