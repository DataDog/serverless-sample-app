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

    const eventPublisherQueue = new ResiliantQueue(
      this,
      "NodeProductPublicEventPublisherQueue",
      {
        sharedProps: props.sharedProps,
        queueName: "NodeProductPublicEventPublisherQueue",
      }
    );
    this.integrationEventPublisherQueue = eventPublisherQueue.queue;

    const dlqProcessor = new InstrumentedLambdaFunction(
      this,
      "NodeProductPublicEventPublisherDLQProcessor",
      {
        sharedProps: props.sharedProps,
        functionName: "NodeProductPublicEventPublisherDLQProcessor",
        handler: "index.handler",
        environment: {
          DLQ_URL: eventPublisherQueue.deadLetterQueue.queueUrl,
        },
        buildDef:
          "./src/product-public-event-publisher/adapters/buildDlqHandlerFunction.js",
        outDir: "./out/dlqHandlerFunction",
        onFailure: undefined,
      }
    ).function;
    dlqProcessor.addEventSource(
      new SqsEventSource(eventPublisherQueue.holdingDlq, {
        batchSize: 1,
      })
    );
    eventPublisherQueue.deadLetterQueue.grantSendMessages(dlqProcessor);

    this.integrationEventPublisherFunction = new InstrumentedLambdaFunction(
      this,
      "NodeProductPublicEventPublisher",
      {
        sharedProps: props.sharedProps,
        functionName: "NodeProductPublicEventPublisher",
        handler: "index.handler",
        environment: {
          PRODUCT_CREATED_TOPIC_ARN: props.productCreatedTopic.topicArn,
          PRODUCT_UPDATED_TOPIC_ARN: props.productUpdatedTopic.topicArn,
          PRODUCT_DELETED_TOPIC_ARN: props.productDeletedTopic.topicArn,
          EVENT_BUS_NAME: props.sharedEventBus.eventBusName,
        },
        buildDef:
          "./src/product-public-event-publisher/adapters/buildPublicEventPublisherFunction.js",
        outDir: "./out/publicEventPublisherFunction",
        onFailure: undefined,
      }
    ).function;

    props.sharedEventBus.grantPutEventsTo(
      this.integrationEventPublisherFunction
    );

    this.integrationEventPublisherFunction.addEventSource(
      new SqsEventSource(this.integrationEventPublisherQueue, {
        reportBatchItemFailures: true,
      })
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
