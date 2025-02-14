// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.DynamoDBv2;
using Amazon.Lambda.Annotations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TestHarness.Lambda.Adapters;

namespace TestHarness.Lambda;

[LambdaStartup]
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {

        var configuration = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .Build();

        services.AddSingleton<IConfiguration>(configuration);
        services.AddSingleton<IEventStore, DynamoDbEventStore>();
        services.AddLogging();

        var dynamoDbClient = new AmazonDynamoDBClient();
        dynamoDbClient.DescribeTableAsync(Environment.GetEnvironmentVariable("TABLE_NAME")).GetAwaiter().GetResult();

        services.AddSingleton(dynamoDbClient);
    }
}