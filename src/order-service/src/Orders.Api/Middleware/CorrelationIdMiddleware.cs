// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Api.Middleware;

/// <summary>
/// Middleware that handles correlation ID generation and propagation
/// </summary>
public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;
    private const string CorrelationIdHeader = "X-Correlation-ID";

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault() 
                           ?? Guid.NewGuid().ToString();

        // Store in context items for use by other middleware and handlers
        context.Items["CorrelationId"] = correlationId;
        
        // Add to response headers
        context.Response.Headers[CorrelationIdHeader] = correlationId;

        await _next(context);
    }
}