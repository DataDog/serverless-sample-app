// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using Orders.Api.Models;
using Orders.Core;
using Orders.Core.Domain.Exceptions;

namespace Orders.Api.Middleware;

/// <summary>
/// Middleware that handles exceptions globally across the application
/// </summary>
public class GlobalExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlingMiddleware> _logger;

    public GlobalExceptionHandlingMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? context.TraceIdentifier;
        
        var (statusCode, errorCode, message, details) = exception switch
        {
            OrderValidationException validationEx => (
                StatusCodes.Status400BadRequest,
                ErrorCodes.ValidationError,
                "Order validation failed",
                validationEx.Message
            ),
            Orders.Core.Domain.Exceptions.OrderNotConfirmedException => (
                StatusCodes.Status409Conflict,
                ErrorCodes.InvalidState,
                "Order must be confirmed before this operation",
                exception.Message
            ),
            InvalidOrderStateException => (
                StatusCodes.Status409Conflict,
                ErrorCodes.InvalidState,
                "Invalid order state transition",
                exception.Message
            ),
            OrderNotFoundException => (
                StatusCodes.Status404NotFound,
                ErrorCodes.NotFound,
                "Order not found",
                exception.Message
            ),
            WorkflowException => (
                StatusCodes.Status503ServiceUnavailable,
                ErrorCodes.ServiceUnavailable,
                "Workflow service unavailable",
                "The order workflow service is currently unavailable. Please try again later."
            ),
            ArgumentException => (
                StatusCodes.Status400BadRequest,
                ErrorCodes.ValidationError,
                "Invalid input provided",
                exception.Message
            ),
            UnauthorizedAccessException => (
                StatusCodes.Status401Unauthorized,
                ErrorCodes.Unauthorized,
                "Authentication required",
                "Valid authentication credentials are required to access this resource"
            ),
            _ => (
                StatusCodes.Status500InternalServerError,
                ErrorCodes.InternalError,
                "An unexpected error occurred",
                "An internal server error occurred. Please try again later."
            )
        };

        context.Response.StatusCode = statusCode;

        var errorResponse = new ErrorResponse(
            errorCode,
            message,
            details,
            null,
            correlationId
        );

        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        
        return context.Response.WriteAsync(JsonSerializer.Serialize(errorResponse, options));
    }
} 