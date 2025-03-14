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
import { SnsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Topic } from "aws-cdk-lib/aws-sns";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { RemovalPolicy, Tags } from "aws-cdk-lib";
import {
  DefinitionBody,
  StateMachine,
  LogLevel,
} from "aws-cdk-lib/aws-stepfunctions";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Table } from "aws-cdk-lib/aws-dynamodb";

export interface InventoryOrderingServiceProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  sharedEventBus: IEventBus;
}

export class InventoryOrderingService extends Construct {
  inventoryOrderingWorkflowTrigger: IFunction;

  constructor(
    scope: Construct,
    id: string,
    props: InventoryOrderingServiceProps
  ) {
    super(scope, id);

    const newProductAddedTopicParam = StringParameter.fromStringParameterName(
      this,
      "NodeNewProductAddedTopicParam",
      "/node/inventory/product-added-topic"
    );

    const topic = Topic.fromTopicArn(
      this,
      "NodeNewProductAddedTopic",
      newProductAddedTopicParam.stringValue
    );

    const tableName = StringParameter.fromStringParameterName(
      this,
      "NodeInventoryApiTableName",
      `/node/${props.sharedProps.environment}/inventory-api/table-name`
    );
    const inventoryTable = Table.fromTableName(
      this,
      "InventoryTable",
      tableName.stringValue
    );

    const workflowLogGroup = new LogGroup(
      this,
      "NodeInventoryOrderingServiceLogGroup",
      {
        logGroupName: `/aws/vendedlogs/states/NodeInventoryOrderingServiceLogGroup-${props.sharedProps.environment}`,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    const workflow = new StateMachine(this, "NodeInventoryOrderingService", {
      stateMachineName: `NodeInventoryOrderingService-${props.sharedProps.environment}`,
      definitionBody: DefinitionBody.fromFile(
        "./lib/inventory-ordering-service/workflows/workflow.setStock.asl.json"
      ),
      definitionSubstitutions: {
        TableName: inventoryTable.tableName,
      },
      logs: {
        destination: workflowLogGroup,
        includeExecutionData: true,
        level: LogLevel.ALL,
      },
    });
    Tags.of(workflow).add("DD_ENHANCED_METRICS", "true");
    Tags.of(workflow).add("DD_TRACE_ENABLED", "true");

    inventoryTable.grantReadWriteData(workflow.role);

    this.inventoryOrderingWorkflowTrigger = new InstrumentedLambdaFunction(
      this,
      "NodeInventoryOrderingWorkflowTrigger",
      {
        sharedProps: props.sharedProps,
        functionName: "NodeInventoryOrderingWorkflow",
        handler: "index.handler",
        environment: {
          ORDERING_SERVICE_WORKFLOW_ARN: workflow.stateMachineArn,
        },
        buildDef:
          "./src/inventory-ordering-service/adapters/buildInventoryOrderingWorkflowTrigger.js",
        outDir: "./out/inventoryOrderingWorkflowTrigger",
        onFailure: undefined,
      }
    ).function;

    const inventoryWorkflowDLQ = new Queue(
      this,
      "NodeInventoryOrderingTriggerDLQ",
      {
        queueName: `NodeInventoryOrderingTriggerDLQ-${props.sharedProps.environment}`,
      }
    );

    this.inventoryOrderingWorkflowTrigger.addEventSource(
      new SnsEventSource(topic, {
        deadLetterQueue: inventoryWorkflowDLQ,
      })
    );

    workflow.grantStartExecution(this.inventoryOrderingWorkflowTrigger);

    const inventoryStateMachineArnParam = new StringParameter(
      this,
      "NodeInventoryOrderingWorkflowArn",
      {
        parameterName: `/node/${props.sharedProps.environment}/inventory-ordering/state-machine-arn`,
        stringValue: workflow.stateMachineArn,
      }
    );
  }
}
