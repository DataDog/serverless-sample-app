// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Inventory.Api.Core;

namespace Inventory.Api.UpdateProductStock;

public class UpdateProductStockHandler
{
    public static async Task<IResult> Handle(UpdateProductStockRequest request, InventoryItems items,
        EventPublisher eventPublisher,
        ILogger<UpdateProductStockHandler> logger)
    {
        try
        {
            var existingInventoryItem = await items.WithProductId(request.ProductId);
            if (existingInventoryItem is null) return Results.NotFound();

            var previousStockLevel = existingInventoryItem.CurrentStockLevel;

            existingInventoryItem.CurrentStockLevel = request.StockLevel;
            await items.Update(existingInventoryItem);

            await eventPublisher.Publish(new InventoryStockUpdatedEvent()
            {
                ProductId = existingInventoryItem.ProductId,
                NewStockLevel = request.StockLevel,
                PreviousStockLevel = previousStockLevel
            });

            return Results.Ok(new InventoryItemDTO(existingInventoryItem));
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error retrieving inventory item");
            return Results.InternalServerError();
        }
    }
}