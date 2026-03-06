//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { ResiliantQueue } from "../constructs/resiliantQueue";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import { PricingServiceProps } from "./pricingServiceProps";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Duration, Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

export interface PricingEventHandlerProps {
  serviceProps: PricingServiceProps;
  ddApiKeySecret: ISecret;
}

const isWorkshopBuild = process.env.WORKSHOP_BUILD === "true";

export class PricingEventHandlers extends Construct {
  productUpdatedQueue: IQueue;
  productCreatedQueue: IQueue;

  constructor(scope: Construct, id: string, props: PricingEventHandlerProps) {
    super(scope, id);

    this.buildHandleProductCreatedFunction(props);
    this.buildHandleProductUpdatedFunction(props);
  }

  buildHandleProductCreatedFunction(props: PricingEventHandlerProps) {
    this.productCreatedQueue = new ResiliantQueue(this, "ProductCreatedQueue", {
      sharedProps: props.serviceProps.getSharedProps(),
      queueName: `ProductCreated`,
    }).queue;

    const entry = isWorkshopBuild
      ? "./src/pricing-api/workshop/productCreatedPricingHandler.ts"
      : "./src/pricing-api/adapters/productCreatedPricingHandler.ts";

    // Workshop builds are uninstrumented — no dd-trace.
    // Production builds exclude dd-trace so the Datadog Lambda layer provides it at runtime.
    const externalModules = isWorkshopBuild
      ? ["@aws-sdk/client-sqs"]
      : [
          "dd-trace",
          "@datadog/native-metrics",
          "@datadog/pprof",
          "@datadog/native-appsec",
          "@datadog/native-iast-taint-tracking",
          "@datadog/native-iast-rewriter",
          "graphql/language/visitor",
          "graphql/language/printer",
          "graphql/utilities",
          "@aws-sdk/client-sqs",
        ];

    const env = props.serviceProps.getSharedProps().environment;
    const productApiEndpointParameterName = `/${env}/ProductService/api-endpoint`;

    const handleProductCreatedFunction = new NodejsFunction(
      this,
      "handleProductCreatedFunction",
      {
        runtime: Runtime.NODEJS_22_X,
        functionName: `CDK-PricingHandleProductCreated-${env}`,
        entry,
        handler: "handler",
        memorySize: 512,
        timeout: Duration.seconds(29),
        environment: {
          ENV: env,
          POWERTOOLS_SERVICE_NAME:
            props.serviceProps.getSharedProps().serviceName,
          POWERTOOLS_LOG_LEVEL: env === "prod" ? "WARN" : "INFO",
          DEPLOYED_AT: new Date().toISOString(),
          BUILD_ID: props.serviceProps.getSharedProps().version,
          TEAM: props.serviceProps.getSharedProps().team,
          DOMAIN: props.serviceProps.getSharedProps().domain,
          EVENT_BUS_NAME: props.serviceProps.getPublisherBus().eventBusName,
          PRODUCT_API_ENDPOINT_PARAMETER: productApiEndpointParameterName,
          ...(isWorkshopBuild
            ? {}
            : {
                DD_DATA_STREAMS_ENABLED: "true",
                DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED: "true",
                DD_TRACE_PROPAGATION_STYLE_EXTRACT: "none",
                DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT: "ignore",
              }),
        },
        bundling: {
          platform: "node",
          target: "node22",
          minify: true,
          keepNames: true,
          externalModules,
        },
      }
    );

    handleProductCreatedFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter${productApiEndpointParameterName}`,
        ],
      })
    );

    props.serviceProps
      .getPublisherBus()
      .grantPutEventsTo(handleProductCreatedFunction);

    handleProductCreatedFunction.addEventSource(
      new SqsEventSource(this.productCreatedQueue, {
        reportBatchItemFailures: true,
      })
    );

    props.serviceProps
      .getSharedProps()
      .datadogConfiguration?.addLambdaFunctions([handleProductCreatedFunction]);

    const rule = props.serviceProps.addSubscriptionRule(
      this,
      `${props.serviceProps.getSharedProps().serviceName}-ProductCreated`,
      {
        detailType: ["product.productCreated.v1"],
        source: [`${props.serviceProps.getSharedProps().environment}.products`],
      }
    );
    rule.addTarget(new SqsQueue(this.productCreatedQueue));
  }

  buildHandleProductUpdatedFunction(props: PricingEventHandlerProps) {
    this.productUpdatedQueue = new ResiliantQueue(this, "ProductUpdatedQueue", {
      sharedProps: props.serviceProps.getSharedProps(),
      queueName: `ProductUpdated`,
    }).queue;

    const entry = isWorkshopBuild
      ? "./src/pricing-api/workshop/productUpdatedPricingHandler.ts"
      : "./src/pricing-api/adapters/productUpdatedPricingHandler.ts";

    // Workshop builds are uninstrumented — no dd-trace.
    // Production builds exclude dd-trace so the Datadog Lambda layer provides it at runtime.
    const externalModules = isWorkshopBuild
      ? ["@aws-sdk/client-sqs"]
      : [
          "dd-trace",
          "@datadog/native-metrics",
          "@datadog/pprof",
          "@datadog/native-appsec",
          "@datadog/native-iast-taint-tracking",
          "@datadog/native-iast-rewriter",
          "graphql/language/visitor",
          "graphql/language/printer",
          "graphql/utilities",
          "@aws-sdk/client-sqs",
        ];

    const env = props.serviceProps.getSharedProps().environment;
    const productApiEndpointParameterName = `/${env}/ProductService/api-endpoint`;

    const handleProductUpdatedFunction = new NodejsFunction(
      this,
      "handleProductUpdatedFunction",
      {
        runtime: Runtime.NODEJS_22_X,
        functionName: `CDK-PricingHandleProductUpdated-${env}`,
        entry,
        handler: "handler",
        memorySize: 512,
        timeout: Duration.seconds(29),
        environment: {
          ENV: env,
          POWERTOOLS_SERVICE_NAME:
            props.serviceProps.getSharedProps().serviceName,
          POWERTOOLS_LOG_LEVEL: env === "prod" ? "WARN" : "INFO",
          DEPLOYED_AT: new Date().toISOString(),
          BUILD_ID: props.serviceProps.getSharedProps().version,
          TEAM: props.serviceProps.getSharedProps().team,
          DOMAIN: props.serviceProps.getSharedProps().domain,
          EVENT_BUS_NAME: props.serviceProps.getPublisherBus().eventBusName,
          PRODUCT_API_ENDPOINT_PARAMETER: productApiEndpointParameterName,
          ...(isWorkshopBuild
            ? {}
            : {
                DD_DATA_STREAMS_ENABLED: "true",
                DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED: "true",
                DD_TRACE_PROPAGATION_STYLE_EXTRACT: "none",
                DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT: "ignore",
              }),
        },
        bundling: {
          platform: "node",
          target: "node22",
          minify: true,
          keepNames: true,
          externalModules,
        },
      }
    );

    handleProductUpdatedFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter${productApiEndpointParameterName}`,
        ],
      })
    );

    props.serviceProps
      .getPublisherBus()
      .grantPutEventsTo(handleProductUpdatedFunction);

    props.serviceProps
      .getSharedProps()
      .datadogConfiguration?.addLambdaFunctions([handleProductUpdatedFunction]);

    handleProductUpdatedFunction.addEventSource(
      new SqsEventSource(this.productUpdatedQueue, {
        reportBatchItemFailures: true,
      })
    );

    const rule = props.serviceProps.addSubscriptionRule(
      this,
      `${props.serviceProps.getSharedProps().serviceName}-ProductUpdated`,
      {
        detailType: ["product.productUpdated.v1"],
        source: [`${props.serviceProps.getSharedProps().environment}.products`],
      }
    );
    rule.addTarget(new SqsQueue(this.productUpdatedQueue));
  }
}
