// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.AspNetCore.Authorization;
using Orders.Core;
using Orders.Core.InternalEvents;

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
        try
        {
            var userClaims = context.User.Claims.ExtractUserId();

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
            
            return Results.Ok(new OrderDTO(newOrder));
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error retrieving inventory item");
            return Results.InternalServerError();
        }
    }
}