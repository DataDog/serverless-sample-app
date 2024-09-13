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
import { IEventBus, Rule } from "aws-cdk-lib/aws-events";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { ResiliantQueue } from "../constructs/resiliantQueue";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import { ITopic, Topic } from "aws-cdk-lib/aws-sns";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

export interface InventoryServiceACLProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  sharedEventBus: IEventBus;
}

export class InventoryServiceACL extends Construct {
  inventoryServiceACLFunction: IFunction;
  orderCreatedPublicEventQueue: IQueue;
  newProductAddedTopic: ITopic;

  constructor(scope: Construct, id: string, props: InventoryServiceACLProps) {
    super(scope, id);

    const newProductAdded = new Topic(this, "RustInventoryProductAddedTopic", {
      topicName: `RustInventoryNewProductAddedTopic-${props.sharedProps.environment}`,
    });

    this.orderCreatedPublicEventQueue = new ResiliantQueue(
      this,
      "OrderCreatedEventQueue",
      {
        sharedProps: props.sharedProps,
        queueName: "RustInventoryOrderCreatedEventQueue",
      }
    ).queue;

    this.inventoryServiceACLFunction = new InstrumentedLambdaFunction(
      this,
      "RustInventoryServiceACL",
      {
        sharedProps: props.sharedProps,
        functionName: "RustInventoryServiceACL",
        handler: "index.handler",
        environment: {
          PRODUCT_ADDED_TOPIC_ARN: newProductAdded.topicArn,
          DD_SERVICE_MAPPING: `lambda_sns:${newProductAdded.topicName},lambda_sqs:${this.orderCreatedPublicEventQueue.queueName}`,
        },
        manifestPath: "./src/inventory-acl/lambdas/product_created_handler/Cargo.toml"
      }
    ).function;
    newProductAdded.grantPublish(this.inventoryServiceACLFunction);

    this.inventoryServiceACLFunction.addEventSource(
      new SqsEventSource(this.orderCreatedPublicEventQueue, {
        reportBatchItemFailures: true,
      })
    );

    const rule = new Rule(this, "Inventory-OrderCreated", {
      eventBus: props.sharedEventBus,
    });
    rule.addEventPattern({
      detailType: ["product.productCreated.v1"],
      source: [`${props.sharedProps.environment}.products`],
    });
    rule.addTarget(new SqsQueue(this.orderCreatedPublicEventQueue));

    const productAddedTopicArnParameter = new StringParameter(
      this,
      "RustInventoryProductAddedArnParameter",
      {
        parameterName: "/rust/inventory/product-added-topic",
        stringValue: newProductAdded.topicArn,
      }
    );

    const productAddedTopicNameParameter = new StringParameter(
      this,
      "RustInventoryProductAddedNameParameter",
      {
        parameterName: "/rust/inventory/product-added-topic-name",
        stringValue: newProductAdded.topicName,
      }
    );
  }
}
