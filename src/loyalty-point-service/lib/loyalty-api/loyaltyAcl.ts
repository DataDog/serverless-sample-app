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
import { ITable, Table } from "aws-cdk-lib/aws-dynamodb";
import { LoyaltyServiceProps } from "./loyaltyServiceProps";

export interface LoyaltyACLServiceProps {
  serviceProps: LoyaltyServiceProps;
  ddApiKeySecret: ISecret;
  loyaltyTable: Table
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
        sharedProps: props.serviceProps.getSharedProps(),
        queueName: `UserCreated`,
      }
    ).queue;

    this.handleUserCreatedFunction = new InstrumentedLambdaFunction(
      this,
      "HandleUserCreatedFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "HandleUserCreated",
        handler: "index.handler",
        environment: {
          TABLE_NAME: props.loyaltyTable.tableName,
          DD_TRACE_DYNAMODB_TABLE_PRIMARY_KEYS: `{"${props.loyaltyTable.tableName}": ["PK"]}`,
        },
        buildDef:
          "./src/loyalty-api/adapters/buildHandleUserCreatedFunction.js",
        outDir: "./out/handleUserCreatedFunction",
        onFailure: undefined,
      }
    ).function;
    props.loyaltyTable.grantReadWriteData(this.handleUserCreatedFunction);

    this.handleUserCreatedFunction.addEventSource(
      new SqsEventSource(this.userCreatedEventQueue, {
        reportBatchItemFailures: true,
      })
    );

    const rule = props.serviceProps.addSubscriptionRule(this, `${props.serviceProps.getSharedProps().serviceName}-UserCreated`, {
      detailType: ["users.userCreated.v1"],
      source: [`${props.serviceProps.getSharedProps().environment}.users`],
    });
    rule.addTarget(new SqsQueue(this.userCreatedEventQueue));
  }

  buildHandleOrderCompletedFunction(props: LoyaltyACLServiceProps) {
    this.orderCompletedEventQueue = new ResiliantQueue(
      this,
      "OrderCompletedQueue",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        queueName: `OrderCompleted`,
      }
    ).queue;

    this.handleOrderCompletedFunction = new InstrumentedLambdaFunction(
      this,
      "HandleOrderCompletedFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "HandleOrderCompleted",
        handler: "index.handler",
        environment: {
          TABLE_NAME: props.loyaltyTable.tableName,
          DD_TRACE_DYNAMODB_TABLE_PRIMARY_KEYS: `{"${props.loyaltyTable.tableName}": ["PK"]}`,
        },
        buildDef:
          "./src/loyalty-api/adapters/buildHandleOrderCompletedFunction.js",
        outDir: "./out/handleOrderCompletedFunction",
        onFailure: undefined,
      }
    ).function;
    props.loyaltyTable.grantReadWriteData(this.handleOrderCompletedFunction);

    this.handleOrderCompletedFunction.addEventSource(
      new SqsEventSource(this.orderCompletedEventQueue, {
        reportBatchItemFailures: true,
      })
    );

    const rule = props.serviceProps.addSubscriptionRule(this, `${props.serviceProps.getSharedProps().serviceName}-OrderCompleted`, {
      detailType: ["orders.orderCompleted.v1"],
      source: [`${props.serviceProps.getSharedProps().environment}.orders`],
    });
    rule.addTarget(new SqsQueue(this.orderCompletedEventQueue));
  }
}
