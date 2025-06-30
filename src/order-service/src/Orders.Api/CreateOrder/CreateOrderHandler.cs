// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Orders.Api.Models;
using Orders.Core;
using Orders.Core.Domain.Exceptions;

namespace Orders.Api.CreateOrder;

public class CreateOrderHandler
{
    [Authorize]
    public static async Task<IResult> Handle(
        HttpContext context,
        CreateOrderRequest request,
        IOrders orders,
        IOrderWorkflow orderWorkflow,
        ILogger<CreateOrderHandler> logger)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();
        
        try
        {
            request.AddToTelemetry();
            
            var userClaims = context.User.Claims.ExtractUserId();

            // Validate request
            if (request.Products == null || !request.Products.Any())
            {
                return Results.BadRequest(new ValidationErrorResponse(
                    ErrorCodes.ValidationError,
                    new Dictionary<string, string[]>
                    {
                        ["Products"] = new[] { "At least one product must be specified" }
                    },
                    correlationId));
            }

            if (request.Products.Count() > 50)
            {
                return Results.BadRequest(new ValidationErrorResponse(
                    ErrorCodes.ValidationError,
                    new Dictionary<string, string[]>
                    {
                        ["Products"] = new[] { "Cannot order more than 50 products at once" }
                    },
                    correlationId));
            }

            Order? newOrder = null;

            if (userClaims.UserType == "PREMIUM")
            {
                newOrder = Order.CreatePriorityOrder(userClaims.UserId, request.Products);
            }
            else
            {
                newOrder = Order.CreateStandardOrder(userClaims.UserId, request.Products);
            }
            
            await orders.Store(newOrder);
            await orderWorkflow.StartWorkflowFor(newOrder);
            
            logger.LogInformation("Order {OrderId} created successfully for user {UserId}", 
                newOrder.OrderNumber, userClaims.UserId);
            
            return Results.Created($"/api/orders/{newOrder.OrderNumber}", new OrderDTO(newOrder));
        }
        catch (OrderValidationException ex)
        {
            logger.LogWarning(ex, "Order validation failed for user {UserId}", 
                context.User.Claims.ExtractUserId().UserId);
            
            return Results.BadRequest(new ValidationErrorResponse(
                ErrorCodes.ValidationError,
                ex.ValidationErrors,
                correlationId));
        }
        catch (InvalidOrderStateException ex)
        {
            logger.LogWarning(ex, "Invalid order state transition attempted");
            
            return Results.Conflict(new ErrorResponse(
                ErrorCodes.InvalidState,
                "Order state transition not allowed",
                ex.Message,
                null,
                correlationId));
        }
        catch (WorkflowException ex)
        {
            logger.LogError(ex, "Workflow failed for order {OrderId}", ex.OrderId.Value);
            
            return Results.Problem(
                detail: "Order workflow could not be started",
                title: "Workflow Error",
                statusCode: 500,
                extensions: new Dictionary<string, object?>
                {
                    ["correlationId"] = correlationId,
                    ["errorCode"] = ErrorCodes.ServiceUnavailable
                });
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Invalid argument provided");
            
            return Results.BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError,
                "Invalid input provided",
                ex.Message,
                null,
                correlationId));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error creating order for user {UserId}", 
                context.User.Claims.ExtractUserId().UserId);
            
            return Results.Problem(
                detail: "An unexpected error occurred while creating the order",
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