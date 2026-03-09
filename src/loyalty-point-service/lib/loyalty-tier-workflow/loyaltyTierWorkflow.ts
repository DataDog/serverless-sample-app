//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Duration, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { ResiliantQueue } from "../constructs/resiliantQueue";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { LoyaltyServiceProps } from "../loyalty-api/loyaltyServiceProps";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface LoyaltyTierWorkflowProps {
  serviceProps: LoyaltyServiceProps;
  ddApiKeySecret: ISecret;
  loyaltyTable: Table;
}

export class LoyaltyTierWorkflow extends Construct {
  tierUpgradeTriggerFunction: IFunction;
  fetchOrderHistoryActivityFunction: IFunction;
  tierUpgradeOrchestratorFunction: IFunction;
  notificationAcknowledgerFunction: IFunction;
  tierUpgradeTriggerQueue: IQueue;
  notificationAcknowledgerQueue: IQueue;

  constructor(scope: Construct, id: string, props: LoyaltyTierWorkflowProps) {
    super(scope, id);

    const env = props.serviceProps.getSharedProps().environment;

    // --- 1. Fetch Order History Activity ---
    // Created first because the orchestrator needs its versioned ARN.
    const activityConstruct = new InstrumentedLambdaFunction(
      this,
      "FetchOrderHistoryActivity",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "FetchOrderHistoryActivity",
        handler: "index.handler",
        environment: {
          JWT_SECRET_PARAM_NAME: `/${env}/shared/secret-access-key`,
          ORDER_SERVICE_ENDPOINT_PARAM: `/${env}/OrderService/api-endpoint`,
        },
        buildDef:
          "./src/loyalty-tier-workflow/activities/buildFetchOrderHistoryActivity.js",
        outDir: "./out/fetchOrderHistoryActivity",
        onFailure: undefined,
      }
    );
    this.fetchOrderHistoryActivityFunction = activityConstruct.function;

    this.fetchOrderHistoryActivityFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:*:*:parameter/${env}/shared/secret-access-key`,
          `arn:aws:ssm:*:*:parameter/${env}/OrderService/api-endpoint`,
        ],
      })
    );

    // --- 2. Tier Upgrade Orchestrator ---
    // Created second so it can reference the activity's versioned ARN.
    const orchestratorConstruct = new InstrumentedLambdaFunction(
      this,
      "TierUpgradeOrchestratorV2",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "TierUpgradeOrchestrator",
        handler: "index.handler",
        environment: {
          TABLE_NAME: props.loyaltyTable.tableName,
          EVENT_BUS_NAME: props.serviceProps.getPublisherBus().eventBusName,
          // Versioned ARN — durable execution pins context.invoke() to a specific version
          // so that mid-execution replays call the same code. NodejsFunction.currentVersion
          // resolves to the version deployed in this CDK synthesis.
          FETCH_ORDER_HISTORY_ACTIVITY_ARN:
            activityConstruct.function.currentVersion.functionArn,
          PRODUCT_SERVICE_ENDPOINT_PARAM: `/${env}/ProductService/api-endpoint`,
          PRODUCT_SEARCH_ENDPOINT_PARAM: `/${env}/ProductSearchService/api-endpoint`,
        },
        buildDef:
          "./src/loyalty-tier-workflow/orchestrator/buildTierUpgradeOrchestrator.js",
        outDir: "./out/tierUpgradeOrchestrator",
        onFailure: undefined,
        durableConfig: {
          // waitForCallback timeout is 300s; allow 15 min for the full workflow
          executionTimeout: Duration.minutes(15),
          retentionPeriod: Duration.days(14),
        },
      }
    );
    this.tierUpgradeOrchestratorFunction = orchestratorConstruct.function;

    props.loyaltyTable.grantReadWriteData(this.tierUpgradeOrchestratorFunction);

    // Orchestrator must checkpoint and replay its own durable execution state.
    // Construct the ARN explicitly to avoid a CDK circular dependency:
    // function.functionArn is a CloudFormation GetAtt which creates
    // Function → Role → Policy → Function (self-referential cycle).
    const orchestratorFunctionArn = Stack.of(this).formatArn({
      service: "lambda",
      resource: "function",
      resourceName: `CDK-${props.serviceProps.getSharedProps().serviceName}-TierUpgradeOrchestratorV2-${env}:*`,
    });
    this.tierUpgradeOrchestratorFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "lambda:CheckpointDurableExecution",
          "lambda:GetDurableExecutionState",
        ],
        resources: [orchestratorFunctionArn],
      })
    );

    // Orchestrator invokes the activity via context.invoke() using its versioned ARN.
    // grantInvoke() only covers the unversioned ARN; we must also allow invocation of
    // all qualified versions (functionArn:*) because context.invoke() uses currentVersion.
    this.tierUpgradeOrchestratorFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [
          activityConstruct.function.functionArn,
          `${activityConstruct.function.functionArn}:*`,
        ],
      })
    );

    // SSM reads for product + order service endpoints and JWT secret
    this.tierUpgradeOrchestratorFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:*:*:parameter/${env}/ProductService/api-endpoint`,
          `arn:aws:ssm:*:*:parameter/${env}/ProductSearchService/api-endpoint`,
        ],
      })
    );

    // --- 3. Tier Upgrade Trigger ---
    // Created third so it can reference the orchestrator function name.
    this.tierUpgradeTriggerQueue = new ResiliantQueue(
      this,
      "TierUpgradeTriggerQueue",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        queueName: "TierUpgradeTrigger",
      }
    ).queue;

    this.tierUpgradeTriggerFunction = new InstrumentedLambdaFunction(
      this,
      "TierUpgradeTrigger",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "TierUpgradeTrigger",
        handler: "index.handler",
        environment: {
          // Versioned ARN — durable execution requires a published version so
          // the Lambda runtime injects DurableExecutionArn with a qualified ARN
          // that matches the IAM policy (name:*). $LATEST or an unqualified name
          // results in an unqualified ARN that the policy does not match.
          // currentVersion resolves to the version deployed in this synthesis.
          ORCHESTRATOR_FUNCTION_NAME:
            this.tierUpgradeOrchestratorFunction.currentVersion.functionArn,
        },
        buildDef:
          "./src/loyalty-tier-workflow/trigger/buildHandleLoyaltyPointsUpdated.js",
        outDir: "./out/tierUpgradeTrigger",
        onFailure: undefined,
      }
    ).function;

    // Trigger invokes the orchestrator asynchronously (Event invocation type)
    this.tierUpgradeOrchestratorFunction.grantInvoke(
      this.tierUpgradeTriggerFunction
    );

    this.tierUpgradeTriggerFunction.addEventSource(
      new SqsEventSource(this.tierUpgradeTriggerQueue, {
        reportBatchItemFailures: true,
      })
    );

    const triggerRule = props.serviceProps.addSubscriptionRule(
      this,
      `${props.serviceProps.getSharedProps().serviceName}-TierUpgradeTrigger`,
      {
        detailType: ["loyalty.pointsAdded.v2"],
        source: [`${env}.loyalty`],
      }
    );
    triggerRule.addTarget(new SqsQueue(this.tierUpgradeTriggerQueue));

    // --- 4. Notification Acknowledger ---
    this.notificationAcknowledgerQueue = new ResiliantQueue(
      this,
      "NotificationAcknowledgerQueue",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        queueName: "NotificationAcknowledger",
      }
    ).queue;

    this.notificationAcknowledgerFunction = new InstrumentedLambdaFunction(
      this,
      "NotificationAcknowledger",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "NotificationAcknowledger",
        handler: "index.handler",
        environment: {},
        buildDef:
          "./src/loyalty-tier-workflow/acknowledger/buildNotificationAcknowledger.js",
        outDir: "./out/notificationAcknowledger",
        onFailure: undefined,
      }
    ).function;

    this.notificationAcknowledgerFunction.addEventSource(
      new SqsEventSource(this.notificationAcknowledgerQueue, {
        reportBatchItemFailures: true,
      })
    );

    const acknowledgerRule = props.serviceProps.addSubscriptionRule(
      this,
      `${props.serviceProps.getSharedProps().serviceName}-NotificationAcknowledger`,
      {
        detailType: ["loyalty.tierUpgraded.v1"],
        source: [`${env}.loyalty`],
      }
    );
    acknowledgerRule.addTarget(new SqsQueue(this.notificationAcknowledgerQueue));

    // Acknowledger calls SendDurableExecutionCallbackSuccess to resume the suspended orchestrator.
    // Use the same pre-constructed ARN to avoid any implicit CDK dependency on the orchestrator function.
    this.notificationAcknowledgerFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "lambda:SendDurableExecutionCallbackSuccess",
          "lambda:SendDurableExecutionCallbackFailure",
        ],
        resources: [orchestratorFunctionArn],
      })
    );
  }
}
