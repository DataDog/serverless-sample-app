//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { loyaltyPointRepository } from "../core/loyaltyPointRepository";
import { LoyaltyPoints } from "../core/loyaltyPoints";
import { ConcurrentModificationError } from "../core/concurrentModificationError";
import { Logger } from "@aws-lambda-powertools/logger";

export class DynamoDbLoyaltyPointRepository implements loyaltyPointRepository {
  private client: DynamoDBClient;
  private logger: Logger;

  constructor(client: DynamoDBClient, logger: Logger) {
    this.client = client;
    this.logger = logger;
  }
  async forUser(userId: string): Promise<LoyaltyPoints | undefined> {
    this.logger.info("Getting loyalty points for user", { userId });

    const params = {
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: {
          S: userId,
        },
      },
    };
    const getItemCommand = new GetItemCommand(params);

    const getItemResponse = await this.client.send(getItemCommand);

    if (getItemResponse.Item === undefined) {
      return undefined;
    }

    const version = getItemResponse.Item["Version"]?.N
      ? parseInt(getItemResponse.Item["Version"].N, 10)
      : 0;

    return new LoyaltyPoints(
      getItemResponse.Item["PK"].S!,
      parseFloat(getItemResponse.Item["Points"].N!),
      JSON.parse(getItemResponse.Item["Orders"].S!),
      version
    );
  }
  async save(loyaltyPoints: LoyaltyPoints): Promise<void> {
    const newVersion = loyaltyPoints.version + 1;
    const isNewItem = loyaltyPoints.version === 0;

    try {
      await this.client.send(
        new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: {
            PK: {
              S: loyaltyPoints.userId,
            },
            Type: {
              S: "LoyaltyAccount",
            },
            Points: {
              N: loyaltyPoints.currentPoints.toString(),
            },
            Orders: {
              S: JSON.stringify(loyaltyPoints.orders),
            },
            Version: {
              N: newVersion.toString(),
            },
          },
          ConditionExpression: isNewItem
            ? "attribute_not_exists(PK) OR attribute_not_exists(Version)"
            : "Version = :expectedVersion",
          ExpressionAttributeValues: isNewItem
            ? undefined
            : {
                ":expectedVersion": { N: loyaltyPoints.version.toString() },
              },
        })
      );

      loyaltyPoints.version = newVersion;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        this.logger.warn("Optimistic locking conflict", {
          userId: loyaltyPoints.userId,
          expectedVersion: loyaltyPoints.version,
        });
        throw new ConcurrentModificationError(loyaltyPoints.userId);
      }
      throw error;
    }
  }
}
