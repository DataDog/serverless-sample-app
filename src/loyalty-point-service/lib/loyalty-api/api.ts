//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  AttributeType,
  BillingMode,
  ITable,
  Table,
  TableClass,
} from "aws-cdk-lib/aws-dynamodb";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { RemovalPolicy } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { LoyaltyServiceProps } from "./loyaltyServiceProps";

export interface ApiProps {
  serviceProps: LoyaltyServiceProps;
  ddApiKeySecret: ISecret;
  jwtSecret: IStringParameter;
}

export class Api extends Construct {
  api: RestApi;
  table: ITable;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.table = new Table(this, "LoyaltyPoints", {
      tableName: `${props.serviceProps.getSharedProps().serviceName}-Points-${
        props.serviceProps.getSharedProps().environment
      }`,
      tableClass: TableClass.STANDARD,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const getPointsIntegration = this.buildGetLoyaltyAccountFunction(props);
    const spendPointsIntegration = this.buildSpendPointsFunction(props);

    this.api = new RestApi(
      this,
      `${props.serviceProps.getSharedProps().serviceName}-API-${
        props.serviceProps.getSharedProps().environment
      }`,
      {
        defaultCorsPreflightOptions: {
          allowOrigins: ["*"],
          allowHeaders: ["*"],
          allowMethods: ["GET,PUT,POST,DELETE"],
        },
      }
    );

    const productResource = this.api.root.addResource("loyalty");
    productResource.addMethod("GET", getPointsIntegration);
    productResource.addMethod("POST", spendPointsIntegration);
  }

  buildGetLoyaltyAccountFunction(props: ApiProps): LambdaIntegration {
    const getPointsFunction = new InstrumentedLambdaFunction(
      this,
      "GetLoyaltyAccountFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "GetLoyaltyAccount",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          JWT_SECRET_PARAM_NAME: props.jwtSecret.parameterName,
        },
        buildDef:
          "./src/loyalty-api/adapters/buildGetLoyaltyAccountFunction.js",
        outDir: "./out/getLoyaltyAccountFunction",
        onFailure: undefined,
      }
    );
    const getPointsIntegration = new LambdaIntegration(
      getPointsFunction.function
    );
    this.table.grantReadData(getPointsFunction.function);
    props.jwtSecret.grantRead(getPointsFunction.function);

    return getPointsIntegration;
  }

  buildSpendPointsFunction(props: ApiProps): LambdaIntegration {
    const spendPointsFunction = new InstrumentedLambdaFunction(
      this,
      "SpendPointsFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "SpendPointsFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          EVENT_BUS_NAME: props.serviceProps.getPublisherBus().eventBusName,
          JWT_SECRET_PARAM_NAME: props.jwtSecret.parameterName,
        },
        buildDef:
          "./src/loyalty-api/adapters/buildSpendLoyaltyPointsFunction.js",
        outDir: "./out/spendLoyaltyPointsFunction",
        onFailure: undefined,
      }
    );
    const spendPointsIntegration = new LambdaIntegration(
      spendPointsFunction.function
    );
    this.table.grantReadWriteData(spendPointsFunction.function);
    props.jwtSecret.grantRead(spendPointsFunction.function);
    props.serviceProps
      .getPublisherBus()
      .grantPutEventsTo(spendPointsFunction.function);

    return spendPointsIntegration;
  }
}
