//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { tracer } from "dd-trace";
import { Logger } from "@aws-lambda-powertools/logger";
import * as jwt from "jsonwebtoken";
import { getUserOrders, OrderRecord } from "../core/adapters/orderServiceClient";

interface FetchOrderHistoryInput {
  userId: string;
}

const logger = new Logger();
const ssmClient = new SSMClient();

export const handler = async (
  event: FetchOrderHistoryInput
): Promise<OrderRecord[]> => {
  const span = tracer.scope().active();

  try {
    span?.addTags({
      "user.id": event.userId,
    });

    logger.info("Fetching order history for user", { userId: event.userId });

    // Read JWT secret from SSM
    const paramResult = await ssmClient.send(
      new GetParameterCommand({
        Name: process.env.JWT_SECRET_PARAM_NAME!,
        WithDecryption: true,
      })
    );

    const secret = paramResult.Parameter?.Value;
    if (!secret) {
      logger.warn("JWT secret not found in SSM, returning empty orders");
      return [];
    }

    // Sign a short-lived JWT for the order service call
    const token = jwt.sign(
      { sub: event.userId, iss: "loyalty-tier-service" },
      secret,
      { expiresIn: "60s" }
    );

    const orders = await getUserOrders(event.userId, token);

    span?.addTags({
      "orders.count": orders.length,
    });

    logger.info("Fetched orders for user", {
      userId: event.userId,
      orderCount: orders.length,
    });

    return orders;
  } catch (error) {
    logger.error("Failed to fetch order history, returning empty array", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
};
