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
import { IEventBus, Match, Rule } from "aws-cdk-lib/aws-events";
import { ResiliantQueue } from "../constructs/resiliantQueue";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import { Duration } from "aws-cdk-lib";

export interface AnalyticsServiceProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  sharedEventBus: IEventBus;
}

export class AnalyticsService extends Construct {
  analyticsServiceFunction: IFunction;

  constructor(scope: Construct, id: string, props: AnalyticsServiceProps) {
    super(scope, id);

    const analyticsEventQueue = new ResiliantQueue(
      this,
      "AnalyticsEventQueue",
      {
        sharedProps: props.sharedProps,
        queueName: "NodeAnalyticsEventQueue",
      }
    ).queue;

    this.analyticsServiceFunction = new InstrumentedLambdaFunction(
      this,
      "NodeAnalyticsService",
      {
        sharedProps: props.sharedProps,
        functionName: "NodeAnalyticsService",
        handler: "index.handler",
        environment: {
          DD_TRACE_PROPAGATION_STYLE: "none",
        },
        buildDef:
          "./src/analytics-backend/adapters/buildAnalyticsEventHandler.js",
        outDir: "./out/analyticsEventHandler",
      }
    ).function;

    this.analyticsServiceFunction.addEventSource(
      new SqsEventSource(analyticsEventQueue, {
        reportBatchItemFailures: true,
        batchSize: 10,
        maxBatchingWindow: Duration.seconds(20),
        maxConcurrency: 2,
      })
    );

    const rule = new Rule(this, "Analytics-AllEvents", {
      eventBus: props.sharedEventBus,
    });
    rule.addEventPattern({
      source: Match.prefix(`${props.sharedProps.environment}.`),
    });
    rule.addTarget(new SqsQueue(analyticsEventQueue));
  }
}
