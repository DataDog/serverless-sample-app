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

  const paramName = process.env.PRODUCT_SEARCH_ENDPOINT_PARAM;
  if (!paramName) {
    throw new Error("PRODUCT_SEARCH_ENDPOINT_PARAM environment variable is not set");
  }

  const result = await ssmClient.send(
    new GetParameterCommand({ Name: paramName })
  );

  cachedBaseUrl = result.Parameter?.Value ?? "";
  return cachedBaseUrl;
}

export interface SearchProduct {
  productId: string;
  name: string;
  price: number;
  stockLevel: number;
}

export interface SearchResult {
  answer: string;
  products: SearchProduct[];
}

export async function search(query: string): Promise<SearchResult> {
  const span = tracer.startSpan("productSearchService.search", {
    childOf: tracer.scope().active() ?? undefined,
  });

  try {
    const baseUrl = await getBaseUrl();
    span.addTags({
      "http.method": "POST",
      "http.url": `${baseUrl}/search`,
      "peer.service": "ProductSearchService",
      "search.query": query,
    });

    const response = await fetch(`${baseUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    span.addTags({ "http.status_code": response.status });

    if (!response.ok) {
      logger.warn("Product search service returned non-OK status", {
        status: response.status,
      });
      return { answer: "", products: [] };
    }

    const data = (await response.json()) as SearchResult;
    return data;
  } catch (error) {
    logger.warn("Failed to search products from product search service", {
      error: error instanceof Error ? error.message : String(error),
    });
    span.addTags({ "error": true });
    return { answer: "", products: [] };
  } finally {
    span.finish();
  }
}
