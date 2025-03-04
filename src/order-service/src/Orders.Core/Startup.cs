// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using Amazon.SimpleNotificationService;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Amazon.StepFunctions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Orders.Core.Adapters;
using Orders.Core.PublicEvents;
using Orders.Core.StockReservationFailure;
using Orders.Core.StockReservationSuccess;
using Serilog;
using Serilog.Formatting.Compact;

namespace Orders.Core;

public static class Startup
{
    public static IServiceCollection AddCore(this IServiceCollection services, IConfiguration configuration)
    {
        Log.Logger = new LoggerConfiguration()
            .Enrich.FromLogContext()
            .MinimumLevel.Is(Serilog.Events.LogEventLevel.Information)
            .WriteTo.Console(new CompactJsonFormatter())
            .CreateBootstrapLogger();
        
        services.AddLogging();

        services.AddAwsServices(configuration);

        return services;
    }

    internal static IServiceCollection AddAwsServices(this IServiceCollection services,
        IConfiguration configuration)
    {
        var environment = configuration["ENV"] ?? "local";
        var regionEndpoint = RegionEndpoint.GetBySystemName(configuration["AWS_REGION"]);

        if (environment is "local")
        {
            var dynamoDbClient = new AmazonDynamoDBClient(new AmazonDynamoDBConfig()
            {
                ServiceURL = "http://localhost:8000",
            });

            try
            {
                dynamoDbClient.CreateTableAsync(new CreateTableRequest()
                {
                    TableName = configuration["TABLE_NAME"],
                    KeySchema = new List<KeySchemaElement>()
                    {
                        new("PK", KeyType.HASH),
                        new("SK", KeyType.RANGE)
                    },
                    AttributeDefinitions = new List<AttributeDefinition>(2)
                    {
                        new("PK", ScalarAttributeType.S),
                        new("SK", ScalarAttributeType.S),
                    },
                    BillingMode = BillingMode.PAY_PER_REQUEST
                }).GetAwaiter().GetResult();
            }
            catch (Exception e)
            {
                Log.Logger.Warning(e, "Failure creating DynamoDB table");
            }
            
            services.AddSingleton(dynamoDbClient);

            services.AddSingleton<IPublicEventPublisher, NoOpEventPublisher>();
            services.AddSingleton<IOrderWorkflow, NoOpOrderWorkflow>();
        }
        else
        {
            var dynamoDbClient = new AmazonDynamoDBClient(regionEndpoint);
            dynamoDbClient.DescribeTableAsync(configuration["TABLE_NAME"]).GetAwaiter().GetResult();
            services.AddSingleton(dynamoDbClient);
            
            var snsClient = new AmazonSimpleNotificationServiceClient(regionEndpoint);
            services.AddSingleton(snsClient);

            var stepFunctionsClient = new AmazonStepFunctionsClient();
            services.AddSingleton(stepFunctionsClient);
            services.AddSingleton<IOrderWorkflow, StepFunctionsOrderWorkflow>();
            
            var eventBridgeClient = new AmazonEventBridgeClient();
            eventBridgeClient.DescribeEventBusAsync(new DescribeEventBusRequest()
            {
                Name = configuration["EVENT_BUS_NAME"]
            }).GetAwaiter().GetResult();
            services.AddSingleton(eventBridgeClient);
            services.AddSingleton<IPublicEventPublisher, EventBridgeEventPublisher>();
        }
        
        services.AddSingleton<IEventGateway, EventGateway>();
        services.AddSingleton<IOrders, DynamoDBOrders>();
        services.AddSingleton<StockReservationFailureHandler>();
        services.AddSingleton<StockReservationSuccessHandler>();
        
        return services;
    }
    
}