//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  DynamoDBClient,
  ScanCommand,
  BatchWriteItemCommand,
  DescribeTableCommand,
  AttributeValue,
} from '@aws-sdk/client-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { connectToDsql, disconnectFromDsql } from './dsqlClient';

const logger = new Logger({ serviceName: 'demo-reset-service' });

const ddbClient = new DynamoDBClient({});

async function getTableKeySchema(tableName: string): Promise<string[]> {
  const response = await ddbClient.send(
    new DescribeTableCommand({ TableName: tableName })
  );
  return (response.Table?.KeySchema ?? []).map((k) => k.AttributeName!);
}

async function deleteAllFromTable(tableName: string): Promise<number> {
  const keyAttributes = await getTableKeySchema(tableName);
  let totalDeleted = 0;
  let lastEvaluatedKey: Record<string, AttributeValue> | undefined;

  do {
    const scanResponse = await ddbClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = scanResponse.Items ?? [];
    lastEvaluatedKey = scanResponse.LastEvaluatedKey;

    // Process in batches of 25
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      const deleteRequests = batch.map((item) => {
        const key: Record<string, AttributeValue> = {};
        for (const attr of keyAttributes) {
          key[attr] = item[attr];
        }
        return { DeleteRequest: { Key: key } };
      });

      let unprocessed: typeof deleteRequests | undefined = deleteRequests;
      let retries = 0;

      while (unprocessed && unprocessed.length > 0 && retries < 3) {
        const response = await ddbClient.send(
          new BatchWriteItemCommand({
            RequestItems: { [tableName]: unprocessed },
          })
        );

        const remaining = response.UnprocessedItems?.[tableName];
        if (remaining && remaining.length > 0) {
          unprocessed = remaining;
          retries++;
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          unprocessed = undefined;
        }
      }

      if (unprocessed && unprocessed.length > 0) {
        logger.warn({
          message: `Failed to delete ${unprocessed.length} items from ${tableName} after retries`,
          unprocessedCount: unprocessed.length,
        });
      }
      totalDeleted += batch.length - (unprocessed?.length ?? 0);
    }
  } while (lastEvaluatedKey);

  return totalDeleted;
}

async function deleteDsqlTables(endpoint: string): Promise<void> {
  const client = await connectToDsql(endpoint);
  try {
    await client.query('DELETE FROM product_prices');
    await client.query('DELETE FROM outbox');
    await client.query('DELETE FROM products');
  } finally {
    await disconnectFromDsql(client);
  }
}

export async function deleteAll(
  env: string
): Promise<{ [table: string]: number }> {
  const tableEnvVars = [
    'ACTIVITIES_TABLE',
    'ACTIVITIES_IDEMPOTENCY_TABLE',
    'ORDERS_TABLE',
    'USERS_TABLE',
    'INVENTORY_TABLE',
    'LOYALTY_TABLE',
    'PRODUCT_SEARCH_TABLE',
  ];

  const results: { [table: string]: number } = {};

  for (const envVar of tableEnvVars) {
    const tableName = process.env[envVar];
    if (!tableName) {
      logger.warn({ message: `Skipping ${envVar}: not set`, env });
      continue;
    }

    try {
      const deleted = await deleteAllFromTable(tableName);
      results[tableName] = deleted;
      logger.info({ message: `Deleted items from ${tableName}`, count: deleted });
    } catch (error) {
      logger.error({ message: `Failed to delete from ${tableName}`, error: (error as Error).message });
      results[tableName] = -1;
    }
  }

  const dsqlEndpoint = process.env.DSQL_CLUSTER_ENDPOINT;
  if (dsqlEndpoint) {
    try {
      await deleteDsqlTables(dsqlEndpoint);
      logger.info({ message: 'DSQL tables cleared' });
    } catch (error) {
      logger.error({ message: 'Failed to clear DSQL tables', error: (error as Error).message });
    }
  } else {
    logger.warn({ message: 'DSQL_CLUSTER_ENDPOINT not set, skipping DSQL cleanup' });
  }

  return results;
}
