//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Request, Response, NextFunction } from "express";
import { EventPublisher, InventoryItems } from "../core/inventory";

type ExpressRouteFunc = (
  req: Request,
  res: Response,
  next?: NextFunction
) => void | Promise<void>;

export function updateInventoryStockLevel(
  inventoryItems: InventoryItems,
  publisher: EventPublisher
): ExpressRouteFunc {
  return async function handler (req: Request, res: Response) {
    const existingItem = await inventoryItems.withProductId(req.body.productId);

    if (!existingItem) {
      res.status(404).send("Product not found");
      return;
    }

    const previousStockLevel = existingItem.stockLevel;

    existingItem.stockLevel = req.body.stockLevel;

    await inventoryItems.store(existingItem);
    await publisher.publish({
      productId: existingItem.productId,
      previousStockLevel,
      newStockLevel: existingItem.stockLevel,
    });

    res.status(201).json(existingItem);
  };
}

export function getInventoryItemRoute(
  inventoryItems: InventoryItems
): ExpressRouteFunc {
  return async function handler (req: Request, res: Response) {
    const item = await inventoryItems.withProductId(req.params.productId);

    if (!item) {
      res.status(404).send("Product not found");
    } else {
      res.json(item);
    }
  };
}
