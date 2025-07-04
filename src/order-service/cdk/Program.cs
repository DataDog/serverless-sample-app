﻿// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.CDK;

namespace OrdersService.CDK;

internal sealed class Program
{
    public static void Main(string[] args)
    {
        var app = new App();
        var ordersService = new OrdersServiceStack(app, "DotnetOrdersServiceStack", new StackProps()
        {
            StackName = $"OrdersService-{System.Environment.GetEnvironmentVariable("ENV")}",
            Env = new Environment()
            {
                Account =  System.Environment.GetEnvironmentVariable("CDK_DEFAULT_ACCOUNT"),
                Region =  System.Environment.GetEnvironmentVariable("CDK_DEFAULT_REGION"),
            }
        });

        app.Synth();
    }
}