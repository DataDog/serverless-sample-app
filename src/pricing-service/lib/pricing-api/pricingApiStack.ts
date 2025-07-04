//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import * as cdk from "aws-cdk-lib";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { Api } from "./api";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { PricingServiceProps } from "./pricingServiceProps";
import { PricingEventHandlers } from "./pricingEventHandlers";
import { DatadogLambda } from "datadog-cdk-constructs-v2";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class PricingApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const service = "PricingService";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";

    const ddApiKey = new Secret(this, "DDApiKeySecret", {
      secretName: `/${env}/${service}/dd-api-key`,
      secretStringValue: new cdk.SecretValue(process.env.DD_API_KEY!),
    });

    // Paste Datadog configuration code here, replacing the SharedProps construct as well
    const datadogConfiguration = new DatadogLambda(this, "Datadog", {
      extensionLayerVersion: 80,
      nodeLayerVersion: 125,
      site: process.env.DD_SITE ?? "datadoghq.com",
      apiKeySecret: ddApiKey,
      service,
      version,
      env,
      enableColdStartTracing: true,
      enableDatadogTracing: true,
      captureLambdaPayload: true,
      injectLogContext: true,
    });

    const sharedProps: SharedProps = {
      team: "pricing",
      domain: "pricing",
      environment: env,
      serviceName: service,
      version,
      datadogConfiguration: datadogConfiguration,
    };

    const pricingServiceProps = new PricingServiceProps(this, sharedProps);

    const api = new Api(this, "PricingApi", {
      serviceProps: pricingServiceProps,
      ddApiKeySecret: ddApiKey,
      jwtSecret: pricingServiceProps.getJwtSecret(),
    });

    // Paste PricingEventHandlers here.
    const eventHandlers = new PricingEventHandlers(
      this,
      "PricingEventHandlers",
      {
        serviceProps: pricingServiceProps,
        ddApiKeySecret: ddApiKey,
      }
    );

    const apiEndpoint = new StringParameter(this, "PricingAPIEndpoint", {
      parameterName: `/${sharedProps.environment}/${sharedProps.serviceName}/api-endpoint`,
      stringValue: api.api.url,
    });

    const output = new cdk.CfnOutput(this, `PricingServiceApiEndpoint-${env}`, {
      exportName: `PricingServiceApiEndpoint-${env}`,
      value: `${api.api.url}pricing`,
    });
  }
}
