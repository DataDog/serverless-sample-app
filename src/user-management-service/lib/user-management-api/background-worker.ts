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
import { ResiliantQueue } from "../constructs/resiliantQueue";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import {ITable} from "aws-cdk-lib/aws-dynamodb";

export interface UserManagementBackgroundWorkersProps {
    sharedProps: SharedProps;
    ddApiKeySecret: ISecret;
    userManagementTable: ITable;
    sharedEventBus: IEventBus;
}

export class UserManagementBackgroundWorkers extends Construct {
    orderCompletedHandlerFunction: IFunction;

    constructor(scope: Construct, id: string, props: UserManagementBackgroundWorkersProps) {
        super(scope, id);

        const orderCompletedPublicEventQueue = new ResiliantQueue(
            this,
            "OrderCompletedEventQueue",
            {
                sharedProps: props.sharedProps,
                queueName: `${props.sharedProps.serviceName}-OrderCompletedQueue`,
            }
        ).queue;

        this.orderCompletedHandlerFunction = new InstrumentedLambdaFunction(
            this,
            "UserManagementOrderCompletedHandler",
            {
                sharedProps: props.sharedProps,
                functionName: "OrderCompletedHandler",
                handler: "index.handler",
                environment: {
                    TABLE_NAME: props.userManagementTable.tableName
                },
                manifestPath: "./src/user-management/lambdas/handle_order_completed_for_user/Cargo.toml"
            }
        ).function;
        props.userManagementTable.grantReadWriteData(this.orderCompletedHandlerFunction);

        this.orderCompletedHandlerFunction.addEventSource(
            new SqsEventSource(orderCompletedPublicEventQueue, {
                reportBatchItemFailures: true,
            })
        );

        const rule = new Rule(this, "UserManagement-OrderCompleted", {
            eventBus: props.sharedEventBus,
        });
        rule.addEventPattern({
            detailType: ["orders.orderCompleted.v1"],
            source: [`${props.sharedProps.environment}.orders`],
        });
        rule.addTarget(new SqsQueue(orderCompletedPublicEventQueue));
    }
}