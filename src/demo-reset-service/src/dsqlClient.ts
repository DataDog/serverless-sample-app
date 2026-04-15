//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { DsqlSigner } from '@aws-sdk/dsql-signer';
import { Client } from 'pg';

export async function connectToDsql(endpoint: string): Promise<Client> {
  const signer = new DsqlSigner({ hostname: endpoint });
  const token = await signer.getDbConnectAdminAuthToken();

  const client = new Client({
    host: endpoint,
    port: 5432,
    database: 'postgres',
    user: 'admin',
    password: token,
    ssl: { rejectUnauthorized: true },
  });

  await client.connect();
  return client;
}

export async function disconnectFromDsql(client: Client): Promise<void> {
  await client.end();
}
