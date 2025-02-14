//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

export interface InventoryItem {
  productId: string;
  stockLevel: number;
}

export interface InventoryItems {
  store(inventoryItem: InventoryItem): Promise<InventoryItem>;
  withProductId(productId: string): Promise<InventoryItem | undefined>;
}

export interface StockLevelUpdatedEvent {
  productId: string;
  previousStockLevel: number;
  newStockLevel: number;
}

export interface EventPublisher {
  publish(evt: StockLevelUpdatedEvent): Promise<boolean>;
}
