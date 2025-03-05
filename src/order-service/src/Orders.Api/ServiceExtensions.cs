// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text;
using Amazon;
using Amazon.DynamoDBv2;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using Amazon.Internal;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Formatting.Compact;
using ILogger = Serilog.ILogger;

namespace Orders.Api;

public static class ServiceExtensions
{
    public static IServiceCollection AddCustomJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var env = configuration["ENV"];
        var secretKey = configuration["Auth:Key"];
        
        if (env != "local")
        {
            var ssmClient = new AmazonSimpleSystemsManagementClient();
            
            secretKey = ssmClient.GetParameterAsync(new GetParameterRequest
            {
                Name = configuration["JWT_SECRET_PARAM_NAME"],
                WithDecryption = true
            }).Result.Parameter.Value;   
        }

        Console.WriteLine($"Using AWS access key: {secretKey}");
        
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
        }).AddJwtBearer(o =>
        {
            o.TokenValidationParameters = new TokenValidationParameters
            {
                IssuerSigningKey = new SymmetricSecurityKey
                    (Encoding.UTF8.GetBytes(secretKey)),
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = false,
                ValidateIssuerSigningKey = true
            };
        });
        
        services.AddAuthorization();

        return services;
    }
}