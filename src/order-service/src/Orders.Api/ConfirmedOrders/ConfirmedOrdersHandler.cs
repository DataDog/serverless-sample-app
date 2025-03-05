// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Orders.Api.CompleteOrder;
using Orders.Api.CreateOrder;
using Orders.Core;

namespace Orders.Api.ConfirmedOrders;

public class ConfirmedOrdersHandler
{
    [Authorize]
    public static async Task<IResult> Handle(
        HttpContext context,
        IOrders orders,
        IEventGateway eventGateway,
        ILogger<CreateOrderHandler> logger)
    {
        try
        {
            var user = context.User.Claims.ExtractUserId();

            if (user.UserType != "ADMIN")
            {
                return Results.Unauthorized();
            }

            var confirmedOrders = await orders.ConfirmedOrders();

            return Results.Ok(confirmedOrders.Select(order => new OrderDTO(order)));
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