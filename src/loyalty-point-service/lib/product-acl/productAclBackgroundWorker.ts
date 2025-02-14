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

export interface ProductAclServiceProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  sharedEventBus: IEventBus;
}

export class ProductAclService extends Construct {
  productServiceAclFunction: IFunction;
  orderCreatedPublicEventQueue: IQueue;
  newProductAddedTopic: ITopic;

  constructor(scope: Construct, id: string, props: ProductAclServiceProps) {
    super(scope, id);

    const inventoryStockUpdatedTopic = new Topic(this, "NodeProductStockLevelUpdated", {
      topicName: `NodeProductStockLevelUpdated-${props.sharedProps.environment}`,
    });

    this.orderCreatedPublicEventQueue = new ResiliantQueue(
      this,
      "InventoryStockUpdatedQueue",
      {
        sharedProps: props.sharedProps,
        queueName: "NodeInventoryStockUpdatedQueue",
      }
    ).queue;

    this.productServiceAclFunction = new InstrumentedLambdaFunction(
      this,
      "NodeProductServiceAcl",
      {
        sharedProps: props.sharedProps,
        functionName: "NodeProductServiceAcl",
        handler: "index.handler",
        environment: {
          STOCK_LEVEL_UPDATED_TOPIC_ARN: inventoryStockUpdatedTopic.topicArn,
        },
        buildDef:
          "./src/product-acl/adapters/buildStockLevelUpdatedPublicEventHandler.js",
        outDir: "./out/stockLevelUpdatedPublicEventHandler",
        onFailure: undefined
      }
    ).function;
    inventoryStockUpdatedTopic.grantPublish(this.productServiceAclFunction);

    this.productServiceAclFunction.addEventSource(
      new SqsEventSource(this.orderCreatedPublicEventQueue, {
        reportBatchItemFailures: true,
      })
    );

    const rule = new Rule(this, "Product-StockUpdated", {
      eventBus: props.sharedEventBus,
    });
    rule.addEventPattern({
      detailType: ["inventory.stockUpdated.v1"],
      source: [`${props.sharedProps.environment}.inventory`],
    });
    rule.addTarget(new SqsQueue(this.orderCreatedPublicEventQueue));

    const inventoryStockUpdatedTopicArn = new StringParameter(
      this,
      "NodeInventoryStockUpdatedTopicArnParameter",
      {
        parameterName: `/node/inventory/${props.sharedProps.environment}/stock-updated-topic`,
        stringValue: inventoryStockUpdatedTopic.topicArn,
      }
    );

    const productAddedTopicNameParameter = new StringParameter(
      this,
      "NodeInventoryStockUpdatedTopicNameParameter",
      {
        parameterName: `/node/inventory/${props.sharedProps.environment}/stock-updated-topic-name`,
        stringValue: inventoryStockUpdatedTopic.topicName,
      }
    );
  }
}
