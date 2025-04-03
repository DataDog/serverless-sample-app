//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Construct } from "constructs";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { ResiliantQueue } from "../constructs/resiliantQueue";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { UserManagementServiceProps } from "./userManagementServiceProps";

export interface UserManagementBackgroundWorkersProps {
  serviceProps: UserManagementServiceProps;
  userManagementTable: ITable;
}

export class UserManagementBackgroundWorkers extends Construct {
  orderCompletedHandlerFunction: IFunction;

  constructor(
    scope: Construct,
    id: string,
    props: UserManagementBackgroundWorkersProps
  ) {
    super(scope, id);

    const orderCompletedPublicEventQueue = new ResiliantQueue(
      this,
      "OrderCompletedEventQueue",
      {
        sharedProps: props.serviceProps.sharedProps,
        queueName: `${props.serviceProps.sharedProps.serviceName}-OrderCompletedQueue`,
      }
    ).queue;

    this.orderCompletedHandlerFunction = new InstrumentedLambdaFunction(
      this,
      "UserManagementOrderCompletedHandler",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OrderCompleted",
        handler: "index.handler",
        environment: {
          TABLE_NAME: props.userManagementTable.tableName,
          USE_SPAN_LINK: "true",
        },
        manifestPath:
          "./src/user-management/lambdas/handle_order_completed_for_user/Cargo.toml",
      }
    ).function;
    props.userManagementTable.grantReadWriteData(
      this.orderCompletedHandlerFunction
    );

    this.orderCompletedHandlerFunction.addEventSource(
      new SqsEventSource(orderCompletedPublicEventQueue, {
        reportBatchItemFailures: true,
      })
    );

    const rule = props.serviceProps.addSubscriptionRule(
      this,
      "UserManagement-OrderCompleted",
      {
        detailType: ["orders.orderCompleted.v1"],
        source: [`${props.serviceProps.sharedProps.environment}.orders`],
      }
    );
    rule.addTarget(new SqsQueue(orderCompletedPublicEventQueue));
  }
}
