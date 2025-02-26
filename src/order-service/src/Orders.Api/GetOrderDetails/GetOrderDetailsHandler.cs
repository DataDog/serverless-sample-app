// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Orders.Core;

namespace Orders.Api.GetOrderDetails;

public class GetOrderDetailsHandler
{
    [Authorize]
    public static async Task<IResult> Handle(HttpContext context, string orderId, IOrders orders, ILogger<GetOrderDetailsHandler> logger)
    {
        try
        {
            var user = context.User.Claims.ExtractUserId();
            var existingOrder = await orders.WithOrderId(user.UserId, orderId);
            if (existingOrder is null) return Results.NotFound();

            return Results.Ok(new OrderDTO(existingOrder));
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error retrieving order item");
            return Results.InternalServerError();
        }
    }
}