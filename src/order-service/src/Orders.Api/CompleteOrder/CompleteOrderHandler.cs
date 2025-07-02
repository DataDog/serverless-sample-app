// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Orders.Api.Models;
using Orders.Core;
using Orders.Core.Domain.Exceptions;
using FluentValidation;

namespace Orders.Api.CompleteOrder;

public class CompleteOrderHandler
{
    [Authorize]
    public static async Task<IResult> Handle(
        HttpContext context,
        CompleteOrderRequest request,
        IOrders orders,
        IEventGateway eventGateway,
        IValidator<CompleteOrderRequest> validator,
        ILogger<CompleteOrderHandler> logger)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();
        
        try
        {
            request.AddToTelemetry();
            
            // Validate request using FluentValidation
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
            
            var user = context.User.Claims.ExtractUserId();

            // Validate authorization
            if (user.UserType != "ADMIN")
            {
                logger.LogWarning("Unauthorized order completion attempt by user {UserId} with type {UserType}", 
                    user.UserId, user.UserType);
                
                return Results.Problem(
                    detail: "Only administrators can complete orders",
                    title: "Forbidden",
                    statusCode: 403,
                    extensions: new Dictionary<string, object?>
                    {
                        ["correlationId"] = correlationId,
                        ["errorCode"] = ErrorCodes.Forbidden
                    });
            }
            
            var existingOrder = await orders.WithOrderId(request.UserId, request.OrderId);

            if (existingOrder == null)
            {
                logger.LogWarning("Order {OrderId} not found for user {UserId}", 
                    request.OrderId, request.UserId);
                
                return Results.Problem(
                    detail: $"Order with ID '{request.OrderId}' not found for user '{request.UserId}'",
                    title: "Order Not Found",
                    statusCode: 404,
                    extensions: new Dictionary<string, object?>
                    {
                        ["correlationId"] = correlationId,
                        ["errorCode"] = ErrorCodes.NotFound
                    });
            }

            existingOrder.CompleteOrder();
            await orders.Store(existingOrder);
            await eventGateway.HandleOrderCompleted(existingOrder);

            logger.LogInformation("Order {OrderId} completed successfully by admin {AdminUserId}", 
                existingOrder.OrderNumber, user.UserId);

            return Results.Ok(new OrderDTO(existingOrder));
        }
        catch (Orders.Core.Domain.Exceptions.OrderNotConfirmedException ex)
        {
            logger.LogWarning(ex, "Attempted to complete unconfirmed order {OrderId}", request.OrderId);
            
            return Results.Conflict(new ErrorResponse(
                ErrorCodes.InvalidState,
                "Order must be confirmed before it can be completed",
                "Only confirmed orders can be marked as complete",
                null,
                correlationId));
        }
        catch (InvalidOrderStateException ex)
        {
            logger.LogWarning(ex, "Invalid order state transition for order {OrderId}", request.OrderId);
            
            return Results.Conflict(new ErrorResponse(
                ErrorCodes.InvalidState,
                "Order state transition not allowed",
                ex.Message,
                null,
                correlationId));
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Invalid argument provided for order completion");
            
            return Results.BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError,
                "Invalid input provided",
                ex.Message,
                null,
                correlationId));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error completing order {OrderId} for user {UserId}", 
                request.OrderId, request.UserId);
            
            return Results.Problem(
                detail: "An unexpected error occurred while completing the order",
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