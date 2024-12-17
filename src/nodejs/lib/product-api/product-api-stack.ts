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
      process.env.DD_API_KEY_SECRET_ARN!
    );

    const service = "NodeProductApi";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";

    const datadogConfiguration = new Datadog(this, "Datadog", {
      nodeLayerVersion: 117,
      extensionLayerVersion: 67,
      site: process.env.DD_SITE ?? "datadoghq.com",
      apiKeySecret: ddApiKey,
      service,
      version,
      env,
      enableColdStartTracing: true,
      enableDatadogTracing: true,
      captureLambdaPayload: true,
    });

    datadogConfiguration.addLambdaFunctions([])

    const sharedProps: SharedProps = {
      team: "products",
      domain: "products",
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
      "NodeProductCreatedTopicArn",
      {
        parameterName: "/node/product/product-created-topic",
        stringValue: api.productCreatedTopic.topicArn,
      }
    );
    const productUpdatedTopicArnParameter = new StringParameter(
      this,
      "NodeProductUpdatedTopicArn",
      {
        parameterName: "/node/product/product-updated-topic",
        stringValue: api.productUpdatedTopic.topicArn,
      }
    );
    const productDeletedTopicArnParameter = new StringParameter(
      this,
      "NodeProductDeletedTopicArn",
      {
        parameterName: "/node/product/product-deleted-topic",
        stringValue: api.productDeletedTopic.topicArn,
      }
    );

    const productCreatedTopicNameParameter = new StringParameter(
      this,
      "NodeProductCreatedTopicName",
      {
        parameterName: "/node/product/product-created-topic-name",
        stringValue: api.productCreatedTopic.topicName,
      }
    );
    const productUpdatedTopicNameParameter = new StringParameter(
      this,
      "NodeProductUpdatedTopicName",
      {
        parameterName: "/node/product/product-updated-topic-name",
        stringValue: api.productUpdatedTopic.topicName,
      }
    );
    const productDeletedTopicNameParameter = new StringParameter(
      this,
      "NodeProductDeletedTopicName",
      {
        parameterName: "/node/product/product-deleted-topic-name",
        stringValue: api.productDeletedTopic.topicName,
      }
    );
    const productApiEndpoint = new StringParameter(
      this,
      "NodeProductApiEndpoint",
      {
        parameterName: `/node/${sharedProps.environment}/product/api-endpoint`,
        stringValue: api.api.url,
      }
    );
  }
}
