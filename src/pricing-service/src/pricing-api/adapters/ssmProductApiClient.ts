//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { Logger } from "@aws-lambda-powertools/logger";
import { ProductApiClient } from "../core/productApiClient";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ProductApiResponse {
  data: {
    productId: string;
    name: string;
    price: number;
  };
}

export class SsmProductApiClient implements ProductApiClient {
  private ssmClient: SSMClient;
  private cachedEndpoint: string = "";
  private cacheExpiry: number = 0;
  private logger: Logger;

  constructor(ssmClient: SSMClient) {
    this.ssmClient = ssmClient;
    this.logger = new Logger({});
  }

  async getProductPrice(productId: string): Promise<number> {
    const baseUrl = await this.getEndpoint();
    const url = `${baseUrl}/product/${productId}`;

    this.logger.info(`Fetching product price from: ${url}`);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `Product API returned ${response.status} for product ${productId}`
      );
    }

    const body: ProductApiResponse = await response.json();
    this.logger.info(`Retrieved price ${body.data.price} for product ${productId}`);
    return body.data.price;
  }

  private async getEndpoint(): Promise<string> {
    const now = Date.now();
    if (this.cachedEndpoint && now < this.cacheExpiry) {
      return this.cachedEndpoint;
    }

    const paramName = process.env.PRODUCT_API_ENDPOINT_PARAMETER!;
    const result = await this.ssmClient.send(
      new GetParameterCommand({ Name: paramName })
    );

    let endpoint = result.Parameter!.Value!;
    if (endpoint.endsWith("/")) {
      endpoint = endpoint.slice(0, -1);
    }

    this.cachedEndpoint = endpoint;
    this.cacheExpiry = now + CACHE_TTL_MS;
    this.logger.info(`Product API endpoint refreshed from SSM: ${endpoint}`);
    return endpoint;
  }
}
