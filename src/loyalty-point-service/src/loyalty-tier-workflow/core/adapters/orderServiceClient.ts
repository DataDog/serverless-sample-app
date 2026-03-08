//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { tracer } from "dd-trace";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({});
const ssmClient = new SSMClient({});

let cachedBaseUrl: string | undefined;

async function getBaseUrl(): Promise<string> {
  if (cachedBaseUrl !== undefined) {
    return cachedBaseUrl;
  }

  const paramName = process.env.ORDER_SERVICE_ENDPOINT_PARAM;
  if (!paramName) {
    throw new Error("ORDER_SERVICE_ENDPOINT_PARAM environment variable is not set");
  }

  const result = await ssmClient.send(
    new GetParameterCommand({ Name: paramName })
  );

  cachedBaseUrl = result.Parameter?.Value ?? "";
  return cachedBaseUrl;
}

export interface OrderRecord {
  orderNumber: string;
  orderStatus: string;
  totalPrice: number;
}

export async function getUserOrders(
  userId: string,
  jwtToken: string
): Promise<OrderRecord[]> {
  const span = tracer.startSpan("orderService.getUserOrders", {
    childOf: tracer.scope().active() ?? undefined,
  });

  try {
    const baseUrl = await getBaseUrl();
    span.addTags({
      "http.method": "GET",
      "http.url": `${baseUrl}/orders`,
      "peer.service": "OrderService",
      "customer.id": userId,
    });

    const response = await fetch(`${baseUrl}/orders`, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    span.addTags({ "http.status_code": response.status });

    if (response.status === 401 || response.status === 403) {
      logger.warn("Unauthorized or forbidden fetching orders for user", {
        userId,
        status: response.status,
      });
      return [];
    }

    if (!response.ok) {
      logger.warn("Order service returned non-OK status", {
        userId,
        status: response.status,
      });
      return [];
    }

    const data = (await response.json()) as OrderRecord[];
    return data;
  } catch (error) {
    logger.warn("Failed to fetch orders from order service", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    span.addTags({ "error": true });
    return [];
  } finally {
    span.finish();
  }
}
