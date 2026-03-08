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

  const paramName = process.env.PRODUCT_SERVICE_ENDPOINT_PARAM;
  if (!paramName) {
    throw new Error("PRODUCT_SERVICE_ENDPOINT_PARAM environment variable is not set");
  }

  const result = await ssmClient.send(
    new GetParameterCommand({ Name: paramName })
  );

  cachedBaseUrl = result.Parameter?.Value ?? "";
  return cachedBaseUrl;
}

export interface ProductRecord {
  productId: string;
  name: string;
  price: number;
}

export async function listProducts(): Promise<ProductRecord[]> {
  const span = tracer.startSpan("productService.listProducts", {
    childOf: tracer.scope().active() ?? undefined,
  });

  try {
    const baseUrl = await getBaseUrl();
    span.addTags({
      "http.method": "GET",
      "http.url": `${baseUrl}/product`,
      "peer.service": "ProductService",
    });

    const response = await fetch(`${baseUrl}/product`, {
      signal: AbortSignal.timeout(5000),
    });

    span.addTags({ "http.status_code": response.status });

    if (!response.ok) {
      logger.warn("Product service returned non-OK status", {
        status: response.status,
      });
      return [];
    }

    const data = (await response.json()) as ProductRecord[];
    return data;
  } catch (error) {
    logger.warn("Failed to fetch products from product service", {
      error: error instanceof Error ? error.message : String(error),
    });
    span.addTags({ "error": true });
    return [];
  } finally {
    span.finish();
  }
}
