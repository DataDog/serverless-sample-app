//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { Api } from "./api";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { PricingServiceProps } from "./pricingServiceProps";
import { DatadogLambda } from "datadog-cdk-constructs-v2/lib/datadog-lambda";
import { PricingEventHandlers } from "./pricingEventHandlers";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class PricingApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const service = "PricingService";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";

    // TODO: Replace this code block with the code from the workshop
    const datadogConfiguration = new DatadogLambda(this, "Datadog", {
      extensionLayerVersion: 96,
      nodeLayerVersion: 137,
      site: process.env.DD_SITE ?? "datadoghq.com",
      apiKey: process.env.DD_API_KEY,
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
      jwtSecret: pricingServiceProps.getJwtSecret(),
    });

    const _ = new PricingEventHandlers(this, "PricingEventHandlers", {
      serviceProps: pricingServiceProps,
    });

    const _param = new StringParameter(this, "PricingAPIEndpoint", {
      parameterName: `/${sharedProps.environment}/${sharedProps.serviceName}/api-endpoint`,
      stringValue: api.api.url,
    });

    const _output = new cdk.CfnOutput(this, `PricingServiceApiEndpoint-${env}`, {
      exportName: `PricingServiceApiEndpoint-${env}`,
      value: `${api.api.url}pricing`,
    });
  }
}
