//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { Logger } from '@aws-lambda-powertools/logger';
import * as jwt from 'jsonwebtoken';
import { SEED_PRODUCTS } from './seedData';

const ssmClient = new SSMClient({});
const logger = new Logger({ serviceName: 'demo-reset-service' });

async function getParameter(name: string): Promise<string> {
  const response = await ssmClient.send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  );
  const value = response.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter not found: ${name}`);
  return value;
}

async function createProduct(
  apiEndpoint: string,
  token: string,
  name: string,
  price: number
): Promise<void> {
  const url = `${apiEndpoint.replace(/\/$/, '')}/product`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, price }),
  });

  if (response.status !== 201) {
    const body = await response.text();
    throw new Error(`Failed to create product '${name}': HTTP ${response.status} — ${body}`);
  }
}

export async function reseedData(): Promise<{ productsSeeded: number }> {
  const jwtSecretParamName = process.env.JWT_SECRET_PARAM_NAME;
  const apiEndpointParamName = process.env.PRODUCT_API_ENDPOINT_PARAM_NAME;

  if (!jwtSecretParamName || !apiEndpointParamName) {
    throw new Error('JWT_SECRET_PARAM_NAME and PRODUCT_API_ENDPOINT_PARAM_NAME must be set');
  }

  const [jwtSecret, apiEndpoint] = await Promise.all([
    getParameter(jwtSecretParamName),
    getParameter(apiEndpointParamName),
  ]);

  const token = jwt.sign(
    { sub: 'demo-reset-service', user_type: 'ADMIN' },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: 300 }
  );

  let productsSeeded = 0;

  for (const product of SEED_PRODUCTS) {
    try {
      await createProduct(apiEndpoint, token, product.name, product.price);
      productsSeeded++;
      logger.info({ message: 'Product created via API', name: product.name });
    } catch (error) {
      logger.error({ message: 'Failed to create product', name: product.name, error: (error as Error).message });
      throw error;
    }
  }

  logger.info({ message: 'Products seeded via API', count: productsSeeded });
  return { productsSeeded };
}
