// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Asp.Versioning;
using Orders.Api.Logging;

namespace Orders.Api.Versioning;

/// <summary>
/// Middleware to handle API version deprecation warnings and sunset notifications
/// </summary>
public class ApiDeprecationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiDeprecationMiddleware> _logger;

    public ApiDeprecationMiddleware(RequestDelegate next, ILogger<ApiDeprecationMiddleware> logger)
    {
        _next = next ?? throw new ArgumentNullException(nameof(next));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();
        
        try
        {
            // Get the requested API version
            var apiVersion = context.GetRequestedApiVersion();
            var userClaims = context.User?.Claims?.ExtractUserId();
            var userType = userClaims?.UserType ?? "ANONYMOUS";
            var endpoint = context.Request.Path.ToString().Replace("\r", "").Replace("\n", "");

            if (apiVersion != null)
            {
                // Check for deprecated versions
                if (apiVersion.MajorVersion == 1 && apiVersion.MinorVersion == 0)
                {
                    // V1.0 is currently stable but will be deprecated in future
                    // Add headers to inform clients about future deprecation
                    context.Response.Headers["X-API-Version"] = apiVersion.ToString();
                    context.Response.Headers["X-API-Supported-Versions"] = "1.0";
                    context.Response.Headers["X-API-Latest-Version"] = "1.0";
                    
                    // Log API version usage for analytics (NO PII)
                    _logger.LogInformation("API version {ApiVersion} accessed by user type {UserType} at sanitized endpoint {Endpoint}", 
                        apiVersion.ToString(), userType, endpoint);
                }
                
                // Future: When V2 is available and V1 becomes deprecated
                /*
                if (apiVersion.MajorVersion == 1)
                {
                    context.Response.Headers.Add("X-API-Deprecated", "true");
                    context.Response.Headers.Add("X-API-Sunset", "2025-12-31");
                    context.Response.Headers.Add("X-API-Deprecation-Info", "API v1 is deprecated. Please migrate to v2 by December 31, 2025.");
                    context.Response.Headers.Add("X-API-Migration-Guide", "https://docs.example.com/api/v2/migration");
                    
                    _logger.LogWarning("Deprecated API version {ApiVersion} accessed by user type {UserType} at endpoint {Endpoint}", 
                        apiVersion.ToString(), userType, endpoint);
                }
                */
                
                // Add standard versioning headers
                context.Response.Headers["X-API-Current-Version"] = apiVersion.ToString();
            }
            else
            {
                // No version specified - using default
                context.Response.Headers["X-API-Version"] = "1.0";
                context.Response.Headers["X-API-Default-Version"] = "true";
                
                _logger.LogInformation("Default API version used by user type {UserType} at sanitized endpoint {Endpoint}", 
                    userType, endpoint);
            }

            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in API deprecation middleware for correlation {CorrelationId}", correlationId);
            
            // Don't block the request if middleware fails
            await _next(context);
        }
    }
}

/// <summary>
/// Extension methods for API deprecation middleware
/// </summary>
public static class ApiDeprecationMiddlewareExtensions
{
    /// <summary>
    /// Adds API deprecation middleware to the pipeline
    /// </summary>
    public static IApplicationBuilder UseApiDeprecation(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<ApiDeprecationMiddleware>();
    }
}