//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { Logger } from '@aws-lambda-powertools/logger';

const ssmClient = new SSMClient({});
const logger = new Logger({ serviceName: 'demo-reset-service' });

const ADMIN_EMAIL = 'admin@serverless-sample.com';
const ADMIN_FIRST_NAME = 'Admin';
const ADMIN_LAST_NAME = 'Serverless';
const ADMIN_PASSWORD = 'Admin!23';

async function getParameter(name: string): Promise<string> {
  const response = await ssmClient.send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  );
  const value = response.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter not found: ${name}`);
  return value;
}

export async function reseedUser(): Promise<void> {
  const apiEndpointParamName = process.env.USER_API_ENDPOINT_PARAM_NAME;
  if (!apiEndpointParamName) {
    throw new Error('USER_API_ENDPOINT_PARAM_NAME must be set');
  }

  const apiEndpoint = await getParameter(apiEndpointParamName);
  const url = `${apiEndpoint.replace(/\/$/, '')}/user`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_address: ADMIN_EMAIL,
      first_name: ADMIN_FIRST_NAME,
      last_name: ADMIN_LAST_NAME,
      password: ADMIN_PASSWORD,
      admin_user: true,
    }),
  });

  if (response.status !== 200) {
    const body = await response.text();
    throw new Error(`Failed to create admin user: HTTP ${response.status} — ${body}`);
  }

  logger.info({ message: 'Admin user reseeded', email: ADMIN_EMAIL });
}
