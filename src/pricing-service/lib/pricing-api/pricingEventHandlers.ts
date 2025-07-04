//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { ResiliantQueue } from "../constructs/resiliantQueue";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import { PricingServiceProps } from "./pricingServiceProps";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface PricingEventHandlerProps {
  serviceProps: PricingServiceProps;
  ddApiKeySecret: ISecret;
}

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

    const pathToBuildFile =
      "./src/pricing-api/adapters/buildProductCreatedPricingHandler.js";
    const pathToOutputFile = "./out/productCreatedPricingHandler";

    const code = Code.fromCustomCommand(pathToOutputFile, [
      "node",
      pathToBuildFile,
    ]);

    const handleProductCreatedFunction = new NodejsFunction(
      this,
      "handleProductCreatedFunction",
      {
        runtime: Runtime.NODEJS_22_X,
        functionName: `CDK-PricingHandleProductCreated-${
          props.serviceProps.getSharedProps().environment
        }`,
        code: code,
        handler: "index.handler",
        memorySize: 512,
        timeout: Duration.seconds(29),
        environment: {
          ENV: props.serviceProps.getSharedProps().environment,
          POWERTOOLS_SERVICE_NAME:
            props.serviceProps.getSharedProps().serviceName,
          POWERTOOLS_LOG_LEVEL:
            props.serviceProps.getSharedProps().environment === "prod"
              ? "WARN"
              : "INFO",
          DEPLOYED_AT: new Date().toISOString(),
          BUILD_ID: props.serviceProps.getSharedProps().version,
          TEAM: props.serviceProps.getSharedProps().team,
          DOMAIN: props.serviceProps.getSharedProps().domain,
          EVENT_BUS_NAME: props.serviceProps.getPublisherBus().eventBusName,
          DD_DATA_STREAMS_ENABLED: "true",
          DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED: "true",
        },
        bundling: {
          platform: "node",
          esbuildArgs: {
            "--bundle": "true",
          },
          target: "node22",
        },
      }
    );
    handleProductCreatedFunction.logGroup.applyRemovalPolicy(
      RemovalPolicy.DESTROY
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

    const pathToBuildFile =
      "./src/pricing-api/adapters/buildProductUpdatedPricingHandler.js";
    const pathToOutputFile = "./out/productUpdatedPricingHandler";

    const code = Code.fromCustomCommand(pathToOutputFile, [
      "node",
      pathToBuildFile,
    ]);

    const handleProductUpdatedFunction = new NodejsFunction(
      this,
      "handleProductUpdatedFunction",
      {
        runtime: Runtime.NODEJS_22_X,
        functionName: `CDK-PricingHandleProductUpdated-${
          props.serviceProps.getSharedProps().environment
        }`,
        code: code,
        handler: "index.handler",
        memorySize: 512,
        timeout: Duration.seconds(29),
        environment: {
          ENV: props.serviceProps.getSharedProps().environment,
          POWERTOOLS_SERVICE_NAME:
            props.serviceProps.getSharedProps().serviceName,
          POWERTOOLS_LOG_LEVEL:
            props.serviceProps.getSharedProps().environment === "prod"
              ? "WARN"
              : "INFO",
          DEPLOYED_AT: new Date().toISOString(),
          BUILD_ID: props.serviceProps.getSharedProps().version,
          TEAM: props.serviceProps.getSharedProps().team,
          DOMAIN: props.serviceProps.getSharedProps().domain,
          EVENT_BUS_NAME: props.serviceProps.getPublisherBus().eventBusName,
          DD_DATA_STREAMS_ENABLED: "true",
          DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED: "true",
        },
        bundling: {
          platform: "node",
          esbuildArgs: {
            "--bundle": "true",
          },
          target: "node22",
        },
      }
    );
    handleProductUpdatedFunction.logGroup.applyRemovalPolicy(RemovalPolicy.DESTROY);

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
