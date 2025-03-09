//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import * as cdk from "aws-cdk-lib";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { Datadog } from "datadog-cdk-constructs-v2";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { Api } from "./api";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { LoyaltyACL } from "./loyaltyAcl";
import { EventBus } from "aws-cdk-lib/aws-events";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class LoyaltyApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const service = "LoyaltyService";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";

    const ddApiKey = new Secret(this, "DDApiKeySecret", {
      secretName: `/${env}/${service}/dd-api-key`,
      secretStringValue: new cdk.SecretValue(process.env.DD_API_KEY!),
    })

    const datadogConfiguration = new Datadog(this, "Datadog", {
      nodeLayerVersion: 121,
      extensionLayerVersion: 73,
      site: process.env.DD_SITE ?? "datadoghq.com",
      apiKeySecret: ddApiKey,
      service,
      version,
      env,
      enableColdStartTracing: true,
      enableDatadogTracing: true,
      captureLambdaPayload: true,
    });

    const sharedProps: SharedProps = {
      team: "loyalty",
      domain: "loyalty",
      environment: env,
      serviceName: service,
      version,
      datadogConfiguration,
    };

    const sharedEventBusParam = StringParameter.fromStringParameterName(
      this,
      "EventBusParameter",
      `/${env}/shared/event-bus-name`
    );
    const sharedAccessKeyParam = StringParameter.fromStringParameterName(
      this,
      "SecretAccessKeyParameter",
      `/${env}/shared/secret-access-key`
    );

    const sharedEventBus = EventBus.fromEventBusName(
      this,
      "SharedEventBus",
      sharedEventBusParam.stringValue
    );

    const api = new Api(this, "LoyaltyAPI", {
      sharedProps,
      ddApiKeySecret: ddApiKey,
      jwtSecret: sharedAccessKeyParam,
    });
    const acl = new LoyaltyACL(this, "LoyaltyACL", {
      sharedProps,
      ddApiKeySecret: ddApiKey,
      sharedEventBus: sharedEventBus,
      loyaltyTable: api.table,
    });

    const apiEndpoint = new StringParameter(this, "LoyaltyAPIEndpoint", {
      parameterName: `/${sharedProps.environment}/${sharedProps.serviceName}/api-endpoint`,
      stringValue: api.api.url,
    });
  }
}
