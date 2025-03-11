//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { ResiliantQueue } from "../constructs/resiliantQueue";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import { PricingServiceProps } from "./pricingServiceProps";

export interface PricingEventHandlerProps {
  serviceProps: PricingServiceProps;
  ddApiKeySecret: ISecret;
}

export class PricingEventHandlers extends Construct {
  handleProductUpdatedFunction: IFunction;
  handleProductCreatedFunction: IFunction;
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

    this.handleProductCreatedFunction = new InstrumentedLambdaFunction(
      this,
      "handleProductCreatedFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "HandleUserCreated",
        handler: "index.handler",
        environment: {
          EVENT_BUS_NAME: props.serviceProps.getPublisherBus().eventBusName,
        },
        buildDef:
          "./src/pricing-api/adapters/buildProductCreatedPricingHandler.js",
        outDir: "./out/productCreatedPricingHandler",
        onFailure: undefined,
      }
    ).function;
    props.serviceProps
      .getPublisherBus()
      .grantPutEventsTo(this.handleProductCreatedFunction);

    this.handleProductCreatedFunction.addEventSource(
      new SqsEventSource(this.productCreatedQueue, {
        reportBatchItemFailures: true,
      })
    );

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

    this.handleProductUpdatedFunction = new InstrumentedLambdaFunction(
      this,
      "handleProductUpdatedFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "HandleUserUpdated",
        handler: "index.handler",
        environment: {
          EVENT_BUS_NAME: props.serviceProps.getPublisherBus().eventBusName,
        },
        buildDef:
          "./src/pricing-api/adapters/buildProductUpdatedPricingHandler.js",
        outDir: "./out/productUpdatedPricingHandler",
        onFailure: undefined,
      }
    ).function;
    props.serviceProps
      .getPublisherBus()
      .grantPutEventsTo(this.handleProductUpdatedFunction);

    this.handleProductUpdatedFunction.addEventSource(
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
