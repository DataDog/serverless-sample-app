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
import { ITable } from "aws-cdk-lib/aws-dynamodb";

export interface LoyaltyACLServiceProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  sharedEventBus: IEventBus;
  loyaltyTable: ITable
}

export class LoyaltyACL extends Construct {
  handleOrderCompletedFunction: IFunction;
  handleUserCreatedFunction: IFunction;
  orderCompletedEventQueue: IQueue;
  userCreatedEventQueue: IQueue;

  constructor(scope: Construct, id: string, props: LoyaltyACLServiceProps) {
    super(scope, id);

    this.buildHandleOrderCompletedFunction(props);
    this.buildHandleUserCreatedFunction(props);
  }

  buildHandleUserCreatedFunction(props: LoyaltyACLServiceProps) {
    this.userCreatedEventQueue = new ResiliantQueue(
      this,
      "UserCreatedQueue",
      {
        sharedProps: props.sharedProps,
        queueName: `${props.sharedProps.serviceName}-UserCreated`,
      }
    ).queue;

    this.handleUserCreatedFunction = new InstrumentedLambdaFunction(
      this,
      "HandleUserCreatedFunction",
      {
        sharedProps: props.sharedProps,
        functionName: "HandleUserCreated",
        handler: "index.handler",
        environment: {
          EVENT_BUS_NAME: props.sharedEventBus.eventBusName,
          TABLE_NAME: props.loyaltyTable.tableName,
        },
        buildDef:
          "./src/loyalty-api/adapters/buildHandleUserCreatedFunction.js",
        outDir: "./out/handleUserCreatedFunction",
        onFailure: undefined
      }
    ).function;
    props.sharedEventBus.grantPutEventsTo(this.handleUserCreatedFunction);
    props.loyaltyTable.grantReadWriteData(this.handleUserCreatedFunction);

    this.handleUserCreatedFunction.addEventSource(
      new SqsEventSource(this.userCreatedEventQueue, {
        reportBatchItemFailures: true,
      })
    );

    const rule = new Rule(this, `${props.sharedProps.serviceName}-UserCreated`, {
      eventBus: props.sharedEventBus,
    });
    rule.addEventPattern({
      detailType: ["users.userCreated.v1"],
      source: [`${props.sharedProps.environment}.users`],
    });
    rule.addTarget(new SqsQueue(this.userCreatedEventQueue));
  }

  buildHandleOrderCompletedFunction(props: LoyaltyACLServiceProps) {
    this.orderCompletedEventQueue = new ResiliantQueue(
      this,
      "OrderCompletedQueue",
      {
        sharedProps: props.sharedProps,
        queueName: `${props.sharedProps.serviceName}-OrderCompleted`,
      }
    ).queue;

    this.handleOrderCompletedFunction = new InstrumentedLambdaFunction(
      this,
      "HandleOrderCompletedFunction",
      {
        sharedProps: props.sharedProps,
        functionName: "HandleOrderCompleted",
        handler: "index.handler",
        environment: {
          EVENT_BUS_NAME: props.sharedEventBus.eventBusName,
          TABLE_NAME: props.loyaltyTable.tableName,
        },
        buildDef:
          "./src/loyalty-api/adapters/buildHandleOrderCompletedFunction.js",
        outDir: "./out/handleOrderCompletedFunction",
        onFailure: undefined
      }
    ).function;
    props.sharedEventBus.grantPutEventsTo(this.handleOrderCompletedFunction);
    props.loyaltyTable.grantReadWriteData(this.handleOrderCompletedFunction);

    this.handleOrderCompletedFunction.addEventSource(
      new SqsEventSource(this.orderCompletedEventQueue, {
        reportBatchItemFailures: true,
      })
    );

    const rule = new Rule(this, `${props.sharedProps.serviceName}-OrderCompleted`, {
      eventBus: props.sharedEventBus,
    });
    rule.addEventPattern({
      detailType: ["orders.orderCompleted.v1"],
      source: [`${props.sharedProps.environment}.orders`],
    });
    rule.addTarget(new SqsQueue(this.orderCompletedEventQueue));
  }
}
