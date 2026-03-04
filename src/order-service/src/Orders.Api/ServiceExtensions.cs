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
    public static TokenValidationParameters CreateTokenValidationParameters(
        string? env,
        string secretKey,
        string? issuer = null,
        string? audience = null)
    {
        var isLocal = string.Equals(env, "local", StringComparison.OrdinalIgnoreCase);

        return new TokenValidationParameters
        {
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
            ValidateIssuer = !isLocal,
            ValidateAudience = !isLocal,
            ValidateLifetime = !isLocal,
            ValidateIssuerSigningKey = true,
            ValidIssuer = issuer,
            ValidAudience = audience
        };
    }

    public static async Task<IServiceCollection> AddCustomJwtAuthenticationAsync(this IServiceCollection services, IConfiguration configuration)
    {
        var env = configuration["ENV"];
        var secretKey = configuration["Auth:Key"];
        var issuer = configuration["Auth:Issuer"];
        var audience = configuration["Auth:Audience"];
        var isLocal = string.Equals(env, "local", StringComparison.OrdinalIgnoreCase);

        if (!isLocal)
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

        if (!isLocal && (string.IsNullOrWhiteSpace(issuer) || string.IsNullOrWhiteSpace(audience)))
        {
            throw new ArgumentException(
                "Invalid JWT issuer/audience configuration provided, application failure. " +
                "Set Auth:Issuer and Auth:Audience for non-local environments.");
        }

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
        }).AddJwtBearer(o =>
        {
            o.TokenValidationParameters = CreateTokenValidationParameters(env, secretKey, issuer, audience);
        });

        services.AddAuthorization();

        return services;
    }
}
