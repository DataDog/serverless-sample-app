// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Orders.Api.Models;
using Orders.Core;
using Orders.Core.Common;
using FluentValidation;
using Orders.Api.Logging;
using System.Diagnostics;

namespace Orders.Api.GetUserOrders;

public class GetUserOrdersHandler
{
    [Authorize]
    public static async Task<IResult> Handle(
        HttpContext context, 
        IOrders orders, 
        IValidator<PaginationQueryRequest> validator,
        ILogger<GetUserOrdersHandler> logger,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? pageToken = null,
        CancellationToken cancellationToken = default)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();
        var stopwatch = Stopwatch.StartNew();
        
        using var performanceScope = logger.BeginPerformanceScope("GetUserOrders", correlationId);
        
        try
        {
            // Log pagination start
            logger.LogPaginationStarted(pageSize, "GetUserOrders");
            
            // Create request object for validation
            var paginationRequest = new PaginationQueryRequest
            {
                PageSize = pageSize,
                PageToken = pageToken
            };
            
            // Validate using FluentValidation
            var validationResult = await validator.ValidateAsync(paginationRequest, cancellationToken);
            if (!validationResult.IsValid)
            {
                var errors = validationResult.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

                logger.LogPaginationValidationFailed(pageSize);
                logger.LogValidationFailed(validationResult.Errors.Count, "GetUserOrders");

                return Results.BadRequest(new ValidationErrorResponse(
                    ErrorCodes.ValidationError,
                    errors,
                    correlationId));
            }

            var user = context.User.Claims.ExtractUserId();
            if (user?.UserId == null)
            {
                logger.LogAuthenticationFailed();
                return Results.Problem(
                    detail: "User authentication information is missing",
                    title: "Authentication Error",
                    statusCode: 401,
                    extensions: new Dictionary<string, object?>
                    {
                        ["correlationId"] = correlationId,
                        ["errorCode"] = ErrorCodes.Unauthorized
                    });
            }

            var userType = user.UserType ?? "Unknown";
            logger.LogUserAuthenticated(userType);

            var pagination = new PaginationRequest(pageSize, pageToken);
            var pagedResult = await orders.ForUser(user.UserId, pagination, cancellationToken);
            
            stopwatch.Stop();

            var response = new 
            {
                Items = pagedResult.Items.Select(order => new OrderDTO(order)),
                PageSize = pagedResult.PageSize,
                HasMorePages = pagedResult.HasMorePages,
                NextPageToken = pagedResult.NextPageToken
            };

            // Log pagination completion with structured context
            logger.LogPaginationCompleted(pagedResult.ItemCount, pagedResult.HasMorePages, stopwatch.ElapsedMilliseconds);
            
            // Log business metrics (NO PII)
            var businessContext = new BusinessMetricsContext
            {
                CorrelationId = correlationId,
                EventType = "OrdersRetrieved",
                UserTier = userType,
                Timestamp = DateTime.UtcNow,
                ProcessingStage = "Retrieved"
            };
            logger.LogBusinessMetrics("User orders retrieved", businessContext);

            return Results.Ok(response);
        }
        catch (ArgumentException ex)
        {
            logger.LogValidationFailed(1, "GetUserOrders");
            
            return Results.BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError,
                "Invalid request parameters",
                ex.Message,
                null,
                correlationId));
        }
        catch (Exception ex)
        {
            var userType = context.User.Claims.ExtractUserId()?.UserType ?? "Unknown";
            logger.LogDatabaseOperationFailed("GetUserOrders", ex);
            
            return Results.Problem(
                detail: "An unexpected error occurred while retrieving orders",
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