// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Orders.Api.Models;
using Orders.Core;
using Orders.Core.Common;
using FluentValidation;

namespace Orders.Api.ConfirmedOrders;

public class ConfirmedOrdersHandler
{
    [Authorize]
    public static async Task<IResult> Handle(
        HttpContext context,
        IOrders orders,
        IEventGateway eventGateway,
        IValidator<PaginationQueryRequest> validator,
        ILogger<ConfirmedOrdersHandler> logger,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? pageToken = null,
        CancellationToken cancellationToken = default)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();
        
        try
        {
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

                return Results.BadRequest(new ValidationErrorResponse(
                    ErrorCodes.ValidationError,
                    errors,
                    correlationId));
            }

            var user = context.User.Claims.ExtractUserId();
            if (user?.UserType != "ADMIN")
            {
                logger.LogWarning("Unauthorized access attempt to confirmed orders by user {UserId} with type {UserType}", 
                    user?.UserId, user?.UserType);
                
                return Results.Problem(
                    detail: "Only administrators can access confirmed orders",
                    title: "Forbidden",
                    statusCode: 403,
                    extensions: new Dictionary<string, object?>
                    {
                        ["correlationId"] = correlationId,
                        ["errorCode"] = ErrorCodes.Forbidden
                    });
            }

            var pagination = new PaginationRequest(pageSize, pageToken);
            var pagedResult = await orders.ConfirmedOrders(pagination, cancellationToken);

            var response = new 
            {
                Items = pagedResult.Items.Select(order => new OrderDTO(order)),
                PageSize = pagedResult.PageSize,
                HasMorePages = pagedResult.HasMorePages,
                NextPageToken = pagedResult.NextPageToken
            };

            logger.LogDebug("Retrieved {ItemCount} confirmed orders", pagedResult.ItemCount);

            return Results.Ok(response);
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Invalid argument provided for confirmed orders retrieval");
            
            return Results.BadRequest(new ErrorResponse(
                ErrorCodes.ValidationError,
                "Invalid request parameters",
                ex.Message,
                null,
                correlationId));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error retrieving confirmed orders");
            
            return Results.Problem(
                detail: "An unexpected error occurred while retrieving confirmed orders",
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