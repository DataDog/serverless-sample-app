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
import { EventBus } from "aws-cdk-lib/aws-events";
import { InventoryOrderingService } from "./inventoryOrderingService";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class InventoryOrderServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ddApiKey = Secret.fromSecretCompleteArn(
      this,
      "DDApiKeySecret",
      process.env.DD_SECRET_ARN!
    );

    const service = "NodeInventoryOrderingService";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";

    const datadogConfiguration = new Datadog(this, "Datadog", {
      nodeLayerVersion: 115,
      extensionLayerVersion: 65,
      site: process.env.DD_SITE ?? "datadoghq.com",
      apiKeySecret: ddApiKey,
      service,
      version,
      env,
      enableColdStartTracing: true,
      enableDatadogTracing: true,
      captureLambdaPayload: true,
    });

    const sharedEventBus = EventBus.fromEventBusName(this, "SharedEventBus", "NodeTracingEventBus");

    const sharedProps: SharedProps = {
      environment: env,
      serviceName: service,
      version,
      datadogConfiguration,
    };

    const aclStack = new InventoryOrderingService(
      this,
      "NodeInventoryOrderingService",
      {
        sharedProps,
        ddApiKeySecret: ddApiKey,
        sharedEventBus,
      }
    );
  }
}
