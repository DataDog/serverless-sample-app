//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import * as cdk from "aws-cdk-lib";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { DatadogLambda } from "datadog-cdk-constructs-v2";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { Api } from "./api";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { EventBus } from "aws-cdk-lib/aws-events";
import { OrderMcpServiceProps } from "./orderMcpServiceProps";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class OrderMcpStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const service = "OrderMcpService";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";

    const ddApiKey = new Secret(this, "DDApiKeySecret", {
      secretName: `/${env}/${service}/dd-api-key`,
      secretStringValue: new cdk.SecretValue(process.env.DD_API_KEY!),
    });

    const datadogConfiguration = new DatadogLambda(this, "Datadog", {
      nodeLayerVersion: 125,
      extensionLayerVersion: 83,
      site: process.env.DD_SITE ?? "datadoghq.com",
      apiKeySecret: ddApiKey,
      service,
      version,
      env,
      enableColdStartTracing: true,
      enableDatadogTracing: true,
      captureLambdaPayload: true,
      redirectHandler: false,
    });

    const sharedProps: SharedProps = {
      team: "order-mcp",
      domain: "order-mcp",
      environment: env,
      serviceName: service,
      version,
      datadogConfiguration,
    };

    const orderMcpServiceProps = new OrderMcpServiceProps(this, sharedProps);

    const api = new Api(this, "OrderMcpApi", {
      serviceProps: orderMcpServiceProps,
      ddApiKeySecret: ddApiKey,
      jwtSecret: orderMcpServiceProps.getJwtSecret(),
    });

    const apiEndpoint = new StringParameter(this, "OrderMcpAPIEndpoint", {
      parameterName: `/${sharedProps.environment}/${sharedProps.serviceName}/api-endpoint`,
      stringValue: api.api.url,
    });
  }
}
