// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Orders.Api.CreateOrder;
using Orders.Core;

namespace Orders.Api.CompleteOrder;

public class CompleteOrderHandler
{
    [Authorize]
    public static async Task<IResult> Handle(
        HttpContext context,
        CompleteOrderRequest request,
        IOrders orders,
        IEventGateway eventGateway,
        ILogger<CreateOrderHandler> logger)
    {
        try
        {
            request.AddToTelemetry();
            
            var user = context.User.Claims.ExtractUserId();

            if (user.UserType != "ADMIN")
            {
                return Results.Unauthorized();
            }
            
            var existingOrder = await orders.WithOrderId(request.UserId, request.OrderId);

            if (existingOrder == null)
            {
                return Results.NotFound();
            }

            existingOrder.CompleteOrder();
            await orders.Store(existingOrder);
            await eventGateway.HandleOrderCompleted(existingOrder);

            return Results.Ok(new OrderDTO(existingOrder));
        }
        catch (OrderNotConfirmedException)
        {
            return Results.BadRequest("");
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error retrieving order");
            return Results.InternalServerError();
        }
    }
}