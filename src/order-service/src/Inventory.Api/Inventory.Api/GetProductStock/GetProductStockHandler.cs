// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Inventory.Api.Core;

namespace Inventory.Api.GetProductStock;

public class GetProductStockHandler
{
    public static async Task<IResult> Handle(string productId, InventoryItems items, ILogger<GetProductStockHandler> logger)
    {
        try
        {
            var existingInventoryItem = await items.WithProductId(productId);
            if (existingInventoryItem is null) return Results.NotFound();

            return Results.Ok(new InventoryItemDTO(existingInventoryItem));
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error retrieving inventory item");
            return Results.InternalServerError();
        }
    }
}