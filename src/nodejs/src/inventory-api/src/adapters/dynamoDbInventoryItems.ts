//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { InventoryItem, InventoryItems } from "../core/inventory";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

export class DynamoDbInventoryItems implements InventoryItems {
  private client: DynamoDBClient;

  constructor(client: DynamoDBClient) {
    this.client = client;
  }
  async store(inventoryItem: InventoryItem): Promise<InventoryItem> {
    await this.client.send(
      new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          PK: {
            S: inventoryItem.productId,
          },
          productId: {
            S: inventoryItem.productId,
          },
          Type: {
            S: "InventoryItem",
          },
          stockLevel: {
            N: inventoryItem.stockLevel.toFixed(2),
          },
        },
      })
    );

    return inventoryItem;
  }
  async withProductId(productId: string): Promise<InventoryItem | undefined> {
    const getItemResponse = await this.client.send(
      new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: {
            S: productId,
          },
        },
      })
    );

    if (getItemResponse.Item === undefined) {
      return undefined;
    }

    let inventoryItem: InventoryItem = {
      productId: getItemResponse.Item["productId"].S!,
      stockLevel: parseFloat(getItemResponse.Item["stockLevel"].N!),
    };

    return inventoryItem;
  }
}
