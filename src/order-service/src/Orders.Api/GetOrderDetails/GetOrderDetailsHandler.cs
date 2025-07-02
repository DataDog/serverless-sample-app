// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Orders.Api.Models;
using Orders.Core;
using Orders.Core.Adapters;
using FluentValidation;

namespace Orders.Api.GetOrderDetails;

public class GetOrderDetailsHandler
{
    [Authorize]
    public static async Task<IResult> Handle(
        HttpContext context, 
        string orderId, 
        IOrders orders, 
        IValidator<GetOrderRequest> validator,
        ILogger<GetOrderDetailsHandler> logger)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();
        
        try
        {
            var user = context.User.Claims.ExtractUserId();
            
            // Create request object for validation
            var request = new GetOrderRequest
            {
                OrderId = orderId,
                UserId = user.UserId
            };
            
            // Validate using FluentValidation
            var validationResult = await validator.ValidateAsync(request);
            if (!validationResult.IsValid)
            {
                var errors = validationResult.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

                return Results.BadRequest(new ValidationErrorResponse(
                    ErrorCodes.ValidationError,
                    errors,
                    correlationId));
            }

            orderId.AddToTelemetry("order.id");
            var existingOrder = await orders.WithOrderId(user.UserId, orderId);
            
            if (existingOrder is null)
            {
                logger.LogWarning("Order {OrderId} not found for user {UserId}", orderId, user.UserId);
                
                return Results.Problem(
                    detail: $"Order with ID '{orderId}' not found",
                    title: "Order Not Found",
                    statusCode: 404,
                    extensions: new Dictionary<string, object?>
                    {
                        ["correlationId"] = correlationId,
                        ["errorCode"] = ErrorCodes.NotFound
                    });
            }

            logger.LogDebug("Order {OrderId} retrieved successfully for user {UserId}", orderId, user.UserId);
            return Results.Ok(new OrderDTO(existingOrder));
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Invalid argument provided for order retrieval");
            
            return Results.BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError,
                "Invalid order ID format",
                ex.Message,
                null,
                correlationId));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error retrieving order {OrderId} for user {UserId}", 
                orderId, context.User.Claims.ExtractUserId().UserId);
            
            return Results.Problem(
                detail: "An unexpected error occurred while retrieving the order",
                title: "Internal Server Error",
                statusCode: 500,
                extensions: new Dictionary<string, object?>
                {
                    ["correlationId"] = correlationId,
                    ["errorCode"] = ErrorCodes.InternalError
                });
        }
    }
}