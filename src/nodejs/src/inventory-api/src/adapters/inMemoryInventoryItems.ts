//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { InventoryItem, InventoryItems } from "../core/inventory";

export class InMemoryInventoryItems implements InventoryItems {
  items: InventoryItem[] = [];
  store(inventoryItem: InventoryItem): Promise<InventoryItem> {
    this.items.push(inventoryItem);
    return Promise.resolve(inventoryItem);
  }
  withProductId(productId: string): Promise<InventoryItem | undefined> {
    return Promise.resolve(
      this.items.find((item) => item.productId === productId)
    );
  }
}
