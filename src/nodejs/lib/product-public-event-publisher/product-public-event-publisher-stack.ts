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
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Topic } from "aws-cdk-lib/aws-sns";
import { ProductPublicEventPublisher } from "./publicEventPublisher";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class ProductPublicEventPublisherStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ddApiKey = Secret.fromSecretCompleteArn(
      this,
      "DDApiKeySecret",
      process.env.DD_API_KEY_SECRET_ARN!
    );

    const service = "NodeProductPublicEventPublisher";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";

    const datadogConfiguration = new Datadog(this, "Datadog", {
      nodeLayerVersion: 120,
      extensionLayerVersion: 68,
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
      team: "products",
      domain: "products",
      environment: env,
      serviceName: service,
      version,
      datadogConfiguration,
    };

    const productCreatedTopicArn = StringParameter.fromStringParameterName(
      this,
      "ProductCreatedTopicArn",
      "/node/product/product-created-topic"
    );
    const productCreatedTopic = Topic.fromTopicArn(
      this,
      "ProductCreatedTopic",
      productCreatedTopicArn.stringValue
    );

    const productUpdatedTopicArn = StringParameter.fromStringParameterName(
      this,
      "ProductUpdatedTopicArn",
      "/node/product/product-updated-topic"
    );
    const productUpdatedTopic = Topic.fromTopicArn(
      this,
      "ProductUpdatedTopic",
      productUpdatedTopicArn.stringValue
    );

    const productDeletedTopicArn = StringParameter.fromStringParameterName(
      this,
      "ProductDeletedTopicArn",
      "/node/product/product-deleted-topic"
    );
    const productDeletedTopic = Topic.fromTopicArn(
      this,
      "ProductDeletedTopic",
      productDeletedTopicArn.stringValue
    );

    const backgroundWorkers = new ProductPublicEventPublisher(
      this,
      "ProductPublicEventPublisher",
      {
        sharedProps,
        ddApiKeySecret: ddApiKey,
        sharedEventBus,
        productCreatedTopic,
        productUpdatedTopic,
        productDeletedTopic,
      }
    );
  }
}
