// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Orders.Core;

namespace Orders.Api.GetUserOrders;

public class GetUserOrdersHandler
{
    [Authorize]
    public static async Task<IResult> Handle(HttpContext context, IOrders orders, ILogger<GetUserOrdersHandler> logger)
    {
        try
        {
            var user = context.User.Claims.ExtractUserId();
            var orderList = await orders.ForUser(user.UserId);

            return Results.Ok(orderList.Select(order => new OrderDTO(order)));
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error retrieving order item");
            return Results.InternalServerError();
        }
    }
}