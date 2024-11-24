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

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class ProductApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ddApiKey = Secret.fromSecretCompleteArn(
      this,
      "DDApiKeySecret",
      process.env.DD_SECRET_ARN!
    );

    const service = "RustProductApi";
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

    const api = new Api(this, "ProductApi", {
      sharedProps,
      ddApiKeySecret: ddApiKey,
    });

    const productCreatedTopicArnParameter = new StringParameter(
      this,
      "RustProductCreatedTopicArn",
      {
        parameterName: "/rust/product/product-created-topic",
        stringValue: api.productCreatedTopic.topicArn,
      }
    );
    const productUpdatedTopicArnParameter = new StringParameter(
      this,
      "RustProductUpdatedTopicArn",
      {
        parameterName: "/rust/product/product-updated-topic",
        stringValue: api.productUpdatedTopic.topicArn,
      }
    );
    const productDeletedTopicArnParameter = new StringParameter(
      this,
      "RustProductDeletedTopicArn",
      {
        parameterName: "/rust/product/product-deleted-topic",
        stringValue: api.productDeletedTopic.topicArn,
      }
    );

    const productCreatedTopicNameParameter = new StringParameter(
      this,
      "RustProductCreatedTopicName",
      {
        parameterName: "/rust/product/product-created-topic-name",
        stringValue: api.productCreatedTopic.topicName,
      }
    );
    const productUpdatedTopicNameParameter = new StringParameter(
      this,
      "RustProductUpdatedTopicName",
      {
        parameterName: "/rust/product/product-updated-topic-name",
        stringValue: api.productUpdatedTopic.topicName,
      }
    );
    const productDeletedTopicNameParameter = new StringParameter(
      this,
      "RustProductDeletedTopicName",
      {
        parameterName: "/rust/product/product-deleted-topic-name",
        stringValue: api.productDeletedTopic.topicName,
      }
    );
    const apiEndpointParameter = new StringParameter(
      this,
      "RustProductApiEndpointParameter",
      {
        parameterName: `/rust/${sharedProps.environment}/product/api-endpoint`,
        stringValue: api.api.url,
      }
    );

    const apiEndpoint = new cdk.CfnOutput(this, "RustProductApiEndpoint", {
      exportName: "RustProductApiEndpoint",
      value: api.api.url,
    });
  }
}
