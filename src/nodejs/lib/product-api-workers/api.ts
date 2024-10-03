//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  ITable,
  Table,
} from "aws-cdk-lib/aws-dynamodb";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { SnsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Queue } from "aws-cdk-lib/aws-sqs";

export interface ApiProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  priceCalculatedTopic: ITopic | undefined;
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
      "ProductApiPricingChangedDLQ",
      {
        queueName: `NodeProductApiPricingChangedDLQ-${props.environment}`,
      }
    );

    const priceCalculatedHandlerFunction = new InstrumentedLambdaFunction(
      this,
      "PriceCalculatedHandlerFunction",
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
      }
    );

    priceCalculatedHandlerFunction.function.addEventSource(
      new SnsEventSource(priceCalculatedTopic, {
        deadLetterQueue: productPricingDeadLetterQueue,
      })
    );

    this.table.grantReadWriteData(priceCalculatedHandlerFunction.function);

    return priceCalculatedHandlerFunction.function;
  }
}
