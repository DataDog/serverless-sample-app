//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { IEventBus } from "aws-cdk-lib/aws-events";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { ResiliantQueue } from "../constructs/resiliantQueue";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { SqsSubscription } from "aws-cdk-lib/aws-sns-subscriptions";

export interface ProductPublicEventPublisherProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  sharedEventBus: IEventBus;
  productCreatedTopic: ITopic;
  productUpdatedTopic: ITopic;
  productDeletedTopic: ITopic;
}

export class ProductPublicEventPublisher extends Construct {
  integrationEventPublisherFunction: IFunction;
  integrationEventPublisherQueue: IQueue;

  constructor(
    scope: Construct,
    id: string,
    props: ProductPublicEventPublisherProps
  ) {
    super(scope, id);

    this.integrationEventPublisherQueue = new ResiliantQueue(
      this,
      "ProductPublicEventPublisherQueue",
      {
        sharedProps: props.sharedProps,
        queueName: "ProductPublicEventPublisherQueue",
      }
    ).queue;

    this.integrationEventPublisherFunction = new InstrumentedLambdaFunction(
      this,
      "ProductPublicEventPublisher",
      {
        sharedProps: props.sharedProps,
        functionName: "NodeProductPublicEventPublisher",
        handler: "index.handler",
        environment: {
          DD_SERVICE_MAPPING: `lambda_sqs:${this.integrationEventPublisherQueue.queueName}`,
          PRODUCT_CREATED_TOPIC_ARN: props.productCreatedTopic.topicArn,
          PRODUCT_UPDATED_TOPIC_ARN: props.productUpdatedTopic.topicArn,
          PRODUCT_DELETED_TOPIC_ARN: props.productDeletedTopic.topicArn,
          EVENT_BUS_NAME: props.sharedEventBus.eventBusName,
        },
        buildDef:
          "./src/product-public-event-publisher/adapters/buildPublicEventPublisherFunction.js",
        outDir: "./out/publicEventPublisherFunction",
      }
    ).function;

    props.sharedEventBus.grantPutEventsTo(
      this.integrationEventPublisherFunction
    );

    this.integrationEventPublisherFunction.addEventSource(
      new SqsEventSource(this.integrationEventPublisherQueue)
    );

    props.productCreatedTopic.addSubscription(
      new SqsSubscription(this.integrationEventPublisherQueue)
    );
    props.productUpdatedTopic.addSubscription(
      new SqsSubscription(this.integrationEventPublisherQueue)
    );
    props.productDeletedTopic.addSubscription(
      new SqsSubscription(this.integrationEventPublisherQueue)
    );
  }
}
