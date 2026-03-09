//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { DurableContext, withDurableExecution } from "@aws/durable-execution-sdk-js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDbTierRepository } from "../core/adapters/dynamoDbTierRepository";
import { listProducts } from "../core/adapters/productServiceClient";
import { search } from "../core/adapters/productSearchClient";
import { EventBridgeTierPublisher } from "../core/adapters/eventBridgeTierPublisher";
import { evaluateTierChange, Tier } from "../core/tier";

interface OrchestratorInput {
  userId: string;
  totalPoints: number;
}

const logger = new Logger();
const dynamoDbClient = new DynamoDBClient();
const eventBridgeClient = new EventBridgeClient();
const tierRepo = new DynamoDbTierRepository(dynamoDbClient, logger);
const eventPublisher = new EventBridgeTierPublisher(eventBridgeClient);

export const handler = withDurableExecution(
  async (event: OrchestratorInput, context: DurableContext) => {
    // Step 1: Read current tier from DynamoDB
    const account = await context.step("read-account", async () => {
      const result = await tierRepo.getForUser(event.userId);
      return result ?? { tier: Tier.Bronze, tierVersion: 0 };
    });

    // Step 2: Evaluate whether tier has changed
    const tierChange = await context.step("evaluate-tier", async () => {
      return evaluateTierChange(event.totalPoints, account.tier);
    });

    if (!tierChange.hasChanged) {
      logger.info("No tier change for user", { userId: event.userId });
      return { status: "no-change" };
    }

    // Step 3: Gather context in parallel — product list and search recommendations
    const gatherResult = await context.parallel(
      "gather-context",
      [
        async (ctx: DurableContext) =>
          ctx.step("list-products", async () => listProducts()),
        async (ctx: DurableContext) =>
          ctx.step(
            "search-recommendations",
            async () =>
              search(
                `loyalty tier upgrade recommendations for ${tierChange.newTier} tier members with ${event.totalPoints} points`
              )
          ),
      ]
    );
    const [products, searchResult] = gatherResult.getResults() as [
      Awaited<ReturnType<typeof listProducts>>,
      Awaited<ReturnType<typeof search>>
    ];

    // Step 4: Invoke fetch-order-history activity Lambda
    await context.invoke(
      "fetch-order-history",
      process.env.FETCH_ORDER_HISTORY_ACTIVITY_ARN!,
      { userId: event.userId }
    );

    // Suppress unused variable warning — products are gathered for context but
    // recommendations come from the search result; include products count in span.
    // Guard against undefined in case a parallel branch failed to produce results.
    logger.info("Gathered product context", { productCount: products?.length ?? 0 });

    // Step 5: Save the upgraded tier
    await context.step("upgrade-tier", async () => {
      await tierRepo.save(
        event.userId,
        tierChange.newTier,
        event.totalPoints,
        account.tierVersion
      );
    });

    // Step 6: Publish event and wait for notification acknowledgement
    await context.waitForCallback(
      "await-notification-ack",
      async (callbackId: string) => {
        await eventPublisher.publishTierUpgraded({
          userId: event.userId,
          previousTier: tierChange.previousTier,
          newTier: tierChange.newTier,
          currentPoints: event.totalPoints,
          upgradedAt: new Date().toISOString(),
          recommendations: (searchResult?.products ?? []).slice(0, 3),
          callbackId,
        });
      },
      { timeout: { seconds: 300 } }
    );

    // Step 7: Record that notification has been acknowledged
    await context.step("record-completion", async () => {
      await tierRepo.recordNotified(event.userId);
    });

    return { status: "upgraded", newTier: tierChange.newTier };
  }
);
