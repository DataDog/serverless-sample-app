// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Orders.Api.Models;
using Orders.Core;
using Orders.Core.Domain.Exceptions;
using FluentValidation;
using Orders.Api.Logging;
using System.Diagnostics;

namespace Orders.Api.CreateOrder;

public class CreateOrderHandler
{
    [Authorize]
    public static async Task<IResult> Handle(
        HttpContext context,
        CreateOrderRequest request,
        IOrders orders,
        IOrderWorkflow orderWorkflow,
        IValidator<CreateOrderRequest> validator,
        ILogger<CreateOrderHandler> logger)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();
        var stopwatch = Stopwatch.StartNew();
        
        using var performanceScope = logger.BeginPerformanceScope("CreateOrder", correlationId);
        
        try
        {
            request.AddToTelemetry();
            
            var userClaims = context.User.Claims.ExtractUserId();
            var userType = userClaims?.UserType ?? "Unknown";
            
            // Log operation start with safe context
            logger.LogOrderCreationStarted(request.Products.Length, userType);
            
            // Validate request using FluentValidation
            var validationStartTime = Stopwatch.GetTimestamp();
            var validationResult = await validator.ValidateAsync(request);
            var validationDuration = Stopwatch.GetElapsedTime(validationStartTime);
            
            if (!validationResult.IsValid)
            {
                var errors = validationResult.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

                logger.LogOrderCreationValidationFailed(validationResult.Errors.Count);
                logger.LogValidationFailed(validationResult.Errors.Count, "CreateOrder");

                return Results.BadRequest(new ValidationErrorResponse(
                    ErrorCodes.ValidationError,
                    errors,
                    correlationId));
            }
            
            logger.LogValidationPassed("CreateOrder", (long)validationDuration.TotalMilliseconds);

            Order? newOrder = null;
            string orderType;

            if (userClaims.UserType == "PREMIUM")
            {
                newOrder = Order.CreatePriorityOrder(userClaims.UserId, request.Products);
                orderType = "Priority";
            }
            else
            {
                newOrder = Order.CreateStandardOrder(userClaims.UserId, request.Products);
                orderType = "Standard";
            }
            
            // Log workflow start
            logger.LogWorkflowStarted("OrderCreation", orderType);
            
            await orders.Store(newOrder);
            await orderWorkflow.StartWorkflowFor(newOrder);
            
            stopwatch.Stop();
            
            // Log successful completion with structured context
            logger.LogOrderCreated(orderType, stopwatch.ElapsedMilliseconds);
            
            // Log business metrics (NO PII)
            var businessContext = new BusinessMetricsContext
            {
                CorrelationId = correlationId,
                EventType = "OrderCreated",
                OrderType = orderType,
                UserTier = userType,
                ProductCount = request.Products.Length,
                Timestamp = DateTime.UtcNow,
                ProcessingStage = "Created"
            };
            logger.LogBusinessMetrics("Order creation completed", businessContext);
            
            return Results.Created($"/api/orders/{newOrder.OrderNumber}", new OrderDTO(newOrder));
        }
        catch (OrderValidationException ex)
        {
            var userType = context.User.Claims.ExtractUserId()?.UserType ?? "Unknown";
            logger.LogOrderCreationValidationFailed(ex.ValidationErrors.Count);
            
            return Results.BadRequest(new ValidationErrorResponse(
                ErrorCodes.ValidationError,
                ex.ValidationErrors,
                correlationId));
        }
        catch (InvalidOrderStateException ex)
        {
            var userType = context.User.Claims.ExtractUserId()?.UserType ?? "Unknown";
            logger.LogOrderCreationFailed(userType, ex);
            
            return Results.Conflict(new ErrorResponse(
                ErrorCodes.InvalidState,
                "Order state transition not allowed",
                ex.Message,
                null,
                correlationId));
        }
        catch (WorkflowException ex)
        {
            var userType = context.User.Claims.ExtractUserId()?.UserType ?? "Unknown";
            logger.LogWorkflowFailed("OrderCreation", "Unknown", ex);
            logger.LogOrderCreationFailed(userType, ex);
            
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
            var userType = context.User.Claims.ExtractUserId()?.UserType ?? "Unknown";
            logger.LogValidationFailed(1, "CreateOrder");
            
            return Results.BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError,
                "Invalid input provided",
                ex.Message,
                null,
                correlationId));
        }
        catch (Exception ex)
        {
            var userType = context.User.Claims.ExtractUserId()?.UserType ?? "Unknown";
            logger.LogOrderCreationFailed(userType, ex);
            
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