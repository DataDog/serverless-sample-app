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

export interface ApiProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  jwtSecret: IStringParameter;
}

export class Api extends Construct {
  api: RestApi;
  table: ITable;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.table = new Table(this, "LoyaltyPoints", {
      tableName: `${props.sharedProps.serviceName}-Points-${props.sharedProps.environment}`,
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
      `${props.sharedProps.serviceName}-API-${props.sharedProps.environment}`,
      {
        defaultCorsPreflightOptions: {
          allowOrigins: ["http://localhost:8080"],
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
        sharedProps: props.sharedProps,
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
    const createProductFunction = new InstrumentedLambdaFunction(
      this,
      "SpendPointsFunction",
      {
        sharedProps: props.sharedProps,
        functionName: "SpendPointsFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          JWT_SECRET_PARAM_NAME: props.jwtSecret.parameterName,
        },
        buildDef:
          "./src/loyalty-api/adapters/buildSpendLoyaltyPointsFunction.js",
        outDir: "./out/spendLoyaltyPointsFunction",
        onFailure: undefined,
      }
    );
    const spendPointsIntegration = new LambdaIntegration(
      createProductFunction.function
    );
    this.table.grantReadWriteData(createProductFunction.function);
    props.jwtSecret.grantRead(createProductFunction.function);

    return spendPointsIntegration;
  }
}
