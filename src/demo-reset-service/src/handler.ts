//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Logger } from '@aws-lambda-powertools/logger';
import tracer from 'dd-trace';
import { deleteAll } from './deleteAll';
import { reseedData } from './reseedData';
import { reseedUser } from './reseedUser';

const logger = new Logger({ serviceName: 'demo-reset-service' });

export const handler = async (event: unknown): Promise<void> => {
  const env = process.env.ENV ?? 'unknown';

  logger.info({ message: 'Starting demo data reset', env });

  const deleteSpan = tracer.startSpan('demo-reset.delete', { childOf: tracer.scope().active() ?? undefined });
  let deleteResults;
  try {
    deleteResults = await deleteAll(env);
    deleteSpan.setTag('tables.count', Object.keys(deleteResults).length);
  } catch (err) {
    deleteSpan.setTag('error', true);
    throw err;
  } finally {
    deleteSpan.finish();
  }

  logger.info({ message: 'Delete phase complete', results: deleteResults });

  const seedSpan = tracer.startSpan('demo-reset.reseed', { childOf: tracer.scope().active() ?? undefined });
  let seedResults;
  try {
    seedResults = await reseedData();
    seedSpan.setTag('products.seeded', seedResults.productsSeeded);
  } catch (err) {
    seedSpan.setTag('error', true);
    throw err;
  } finally {
    seedSpan.finish();
  }

  logger.info({ message: 'Reseed phase complete', results: seedResults });

  const userSpan = tracer.startSpan('demo-reset.reseed-user', { childOf: tracer.scope().active() ?? undefined });
  try {
    await reseedUser();
  } catch (err) {
    userSpan.setTag('error', true);
    throw err;
  } finally {
    userSpan.finish();
  }

  logger.info({ message: 'Admin user reseeded' });

  logger.info({
    message: 'Demo reset complete',
    env,
    deleteResults,
    seedResults,
  });
};
