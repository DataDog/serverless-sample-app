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
            var userClaims = context.User.Claims.ExtractUserId();

            var order = await orders.WithOrderId(userClaims.UserId, request.OrderId);

            if (order == null)
            {
                return Results.NotFound();
            }

            order.CompleteOrder();
            await orders.Store(order);
            await eventGateway.HandleOrderCompleted(order);

            return Results.Ok(new OrderDTO(order));
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