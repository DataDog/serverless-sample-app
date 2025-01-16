//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ITable, Table } from "aws-cdk-lib/aws-dynamodb";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { SnsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { SqsDestination } from "aws-cdk-lib/aws-lambda-destinations";

export interface ApiProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  priceCalculatedTopic: ITopic | undefined;
  stockLevelUpdatedTopic: ITopic | undefined;
}

export class ApiWorker extends Construct {
  private table: ITable;
  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.table = Table.fromTableName(
      this,
      "NodeProductTable",
      `NodeProducts-${props.sharedProps.environment}`
    );

    const priceCalculatedFunction = this.buildPriceCalculatedHandlerFunction(
      props.sharedProps,
      props.priceCalculatedTopic
    );

    const stockLevelUpdatedFunction =
      this.buildStockLevelUpdatedHandlerFunction(
        props.sharedProps,
        props.stockLevelUpdatedTopic
      );
  }

  buildPriceCalculatedHandlerFunction(
    props: SharedProps,
    priceCalculatedTopic: ITopic | undefined
  ): IFunction | undefined {
    if (priceCalculatedTopic === undefined) {
      return undefined;
    }

    const productPricingDeadLetterQueue = new Queue(
      this,
      "NodeProductApiPricingChangedDLQ",
      {
        queueName: `NodeProductApiPricingChangedDLQ-${props.environment}`,
      }
    );

    const priceCalculatedHandlerFunction = new InstrumentedLambdaFunction(
      this,
      "NodePriceCalculatedHandlerFunction",
      {
        sharedProps: props,
        functionName: "NodePriceCalculatedHandlerFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          DD_SERVICE_MAPPING: `lambda_sns:${priceCalculatedTopic.topicName}`,
        },
        buildDef:
          "./src/product-api/adapters/buildHandlePricingChangedFunction.js",
        outDir: "./out/handlePricingChangedFunction",
        onFailure: new SqsDestination(productPricingDeadLetterQueue),
      }
    );

    priceCalculatedHandlerFunction.function.addEventSource(
      new SnsEventSource(priceCalculatedTopic, {
        deadLetterQueue: productPricingDeadLetterQueue,
      })
    );

    // productPricingDeadLetterQueue.addToResourcePolicy(
    //   new PolicyStatement({
    //     effect: Effect.ALLOW,
    //     principals: [new ServicePrincipal("sns.amazonaws.com")],
    //     actions: ["sqs:SendMessage"],
    //     resources: [productPricingDeadLetterQueue.queueArn],
    //     conditions: {
    //       ArnEquals: {
    //         "aws:SourceArn": priceCalculatedTopic,
    //       },
    //     },
    //   })
    // );

    this.table.grantReadWriteData(priceCalculatedHandlerFunction.function);

    return priceCalculatedHandlerFunction.function;
  }

  buildStockLevelUpdatedHandlerFunction(
    props: SharedProps,
    stockLevelUpdatedTopic: ITopic | undefined
  ): IFunction | undefined {
    if (stockLevelUpdatedTopic === undefined) {
      return undefined;
    }

    const productStockLevelUpdatedDLQ = new Queue(
      this,
      "NodeProductApiStockLevelUpdatedDLQ",
      {
        queueName: `NodeProductApiStockLevelUpdatedDLQ-${props.environment}`,
      }
    );

    const stockLevelUpdatedHandlerFunction = new InstrumentedLambdaFunction(
      this,
      "NodeProductApiStockLevelUpdatedFunction",
      {
        sharedProps: props,
        functionName: "NodeProductApiStockLevelUpdatedFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          DD_SERVICE_MAPPING: `lambda_sns:${stockLevelUpdatedTopic.topicName}`,
        },
        buildDef:
          "./src/product-api/adapters/buildHandleStockLevelUpdatedFunction.js",
        outDir: "./out/handleStockLevelUpdatedFunction",
        onFailure: new SqsDestination(productStockLevelUpdatedDLQ),
      }
    );

    stockLevelUpdatedHandlerFunction.function.addEventSource(
      new SnsEventSource(stockLevelUpdatedTopic, {
        deadLetterQueue: productStockLevelUpdatedDLQ,
      })
    );

    this.table.grantReadWriteData(stockLevelUpdatedHandlerFunction.function);

    return stockLevelUpdatedHandlerFunction.function;
  }
}
