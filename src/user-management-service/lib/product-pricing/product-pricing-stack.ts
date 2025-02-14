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
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Topic } from "aws-cdk-lib/aws-sns";
import { ProductPricingService } from "./productPricingService";
import { SharedProps } from "../constructs/sharedFunctionProps";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class ProductPricingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ddApiKey = Secret.fromSecretCompleteArn(
      this,
      "DDApiKeySecret",
      process.env.DD_API_KEY_SECRET_ARN!
    );

    const service = "RustProductPricingService";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";

    const datadogConfiguration = new Datadog(this, "Datadog", {
      extensionLayerVersion: 66,
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
      environment: env,
      serviceName: service,
      version,
      datadogConfiguration,
    };

    const productCreatedTopicArn = StringParameter.fromStringParameterName(
      this,
      "ProductCreatedTopicArn",
      "/rust/product/product-created-topic"
    );
    const productCreatedTopic = Topic.fromTopicArn(
      this,
      "ProductCreatedTopic",
      productCreatedTopicArn.stringValue
    );

    const productUpdatedTopicArn = StringParameter.fromStringParameterName(
      this,
      "ProductUpdatedTopicArn",
      "/rust/product/product-updated-topic"
    );
    const productUpdatedTopic = Topic.fromTopicArn(
      this,
      "ProductUpdatedTopic",
      productUpdatedTopicArn.stringValue
    );

    const productPricingService = new ProductPricingService(
      this,
      "RustProductPricingService",
      {
        sharedProps,
        productCreatedTopic,
        productUpdatedTopic,
      }
    );

    const productPricingTopicArnParameter = new StringParameter(
      this,
      "RustProductPricingCalculatedTopicArn",
      {
        parameterName: "/rust/product/pricing-calculated-topic",
        stringValue: productPricingService.priceCalculatedTopic.topicArn,
      }
    );

    const productPricingTopicNameParameter = new StringParameter(
      this,
      "RustProductPricingCalculatedTopicName",
      {
        parameterName: "/rust/product/pricing-calculated-topic-name",
        stringValue: productPricingService.priceCalculatedTopic.topicArn,
      }
    );
  }
}
