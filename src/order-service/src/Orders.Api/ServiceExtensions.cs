// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace Orders.Api;

public static class ServiceExtensions
{
    public static async Task<IServiceCollection> AddCustomJwtAuthenticationAsync(this IServiceCollection services, IConfiguration configuration)
    {
        var env = configuration["ENV"];
        var secretKey = configuration["Auth:Key"];
        
        if (env != "local")
        {
            var ssmClient = new AmazonSimpleSystemsManagementClient();
            
            var paramResult = await ssmClient.GetParameterAsync(new GetParameterRequest
            {
                Name = configuration["JWT_SECRET_PARAM_NAME"],
                WithDecryption = true
            });
            
            secretKey = paramResult.Parameter.Value;   
        }

        Console.WriteLine($"Using JWT secret: [REDACTED]");

        if (secretKey is null)
        {
            throw new ArgumentException("Invalid JWT Secret Access Key provided, application failure.");
        }
        
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