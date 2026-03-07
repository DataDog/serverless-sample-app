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
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { Tier } from "../tier";
import { TierRepository } from "../tierRepository";
import { Logger } from "@aws-lambda-powertools/logger";

export class DynamoDbTierRepository implements TierRepository {
  private client: DynamoDBClient;
  private logger: Logger;

  constructor(client: DynamoDBClient, logger: Logger) {
    this.client = client;
    this.logger = logger;
  }

  async getForUser(
    userId: string
  ): Promise<{ tier: Tier; tierVersion: number } | null> {
    this.logger.info("Getting tier for user", { userId });

    const result = await this.client.send(
      new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: { S: `TIER#${userId}` },
        },
      })
    );

    if (result.Item === undefined) {
      return null;
    }

    const tier = (result.Item["Tier"]?.S ?? Tier.Bronze) as Tier;
    const tierVersion = result.Item["TierVersion"]?.N
      ? parseInt(result.Item["TierVersion"].N, 10)
      : 0;

    return { tier, tierVersion };
  }

  async save(
    userId: string,
    tier: Tier,
    pointsAtUpgrade: number,
    currentVersion: number
  ): Promise<void> {
    this.logger.info("Saving tier for user", { userId, tier, currentVersion });

    const newVersion = currentVersion + 1;
    const isNewItem = currentVersion === 0;

    try {
      await this.client.send(
        new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: {
            PK: { S: `TIER#${userId}` },
            UserId: { S: userId },
            Tier: { S: tier },
            PointsAtUpgrade: { N: pointsAtUpgrade.toString() },
            UpgradedAt: { S: new Date().toISOString() },
            TierVersion: { N: newVersion.toString() },
          },
          ConditionExpression: isNewItem
            ? "attribute_not_exists(PK)"
            : "TierVersion = :expectedVersion",
          ExpressionAttributeValues: isNewItem
            ? undefined
            : {
                ":expectedVersion": { N: currentVersion.toString() },
              },
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        this.logger.warn("Optimistic locking conflict saving tier", {
          userId,
          expectedVersion: currentVersion,
        });
        throw error;
      }
      throw error;
    }
  }

  async recordNotified(userId: string): Promise<void> {
    this.logger.info("Recording notification for user", { userId });

    await this.client.send(
      new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: { S: `TIER#${userId}` },
        },
        UpdateExpression: "SET NotifiedAt = :notifiedAt",
        ExpressionAttributeValues: {
          ":notifiedAt": { S: new Date().toISOString() },
        },
      })
    );
  }
}
