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
import { SnsTopic } from "aws-cdk-lib/aws-events-targets";
import { ITopic, Topic } from "aws-cdk-lib/aws-sns";
import { IEventBus } from "aws-cdk-lib/aws-events";

export interface UserManagementApiProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
  jwtSecretKeyParameter: IStringParameter;
  sharedEventBus: IEventBus;
}

export class UserManagementApi extends Construct {
  get table(): ITable {
    return this._table;
  }
  api: RestApi;
  private _table: ITable;

  constructor(scope: Construct, id: string, props: UserManagementApiProps) {
    super(scope, id);

    this._table = new Table(this, "UserManagementTable", {
      tableName: `${props.sharedProps.serviceName}-Users-${props.sharedProps.environment}`,
      tableClass: TableClass.STANDARD,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const registerUserIntegration = this.buildRegisterUserFunction(
      props.sharedProps,
      props.sharedEventBus
    );
    const loginIntegration = this.buildLoginFunction(props);
    const getUserDetailsIntegration = this.buildGetUserDetailsFunction(props);

    this.api = new RestApi(this, "UserManagementApi", {
      restApiName: `${props.sharedProps.serviceName}-Api-${props.sharedProps.environment}`,
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowHeaders: ["*"],
        allowMethods: ["GET,PUT,POST,DELETE"],
      },
    });

    const userResource = this.api.root.addResource("user");
    userResource.addMethod("POST", registerUserIntegration);

    const userIdResource = userResource.addResource("{userId}");
    userIdResource.addMethod("GET", getUserDetailsIntegration);

    const loginResource = this.api.root.addResource("login");
    loginResource.addMethod("POST", loginIntegration);
  }

  buildRegisterUserFunction(
    props: SharedProps,
    sharedEventBus: IEventBus
  ): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "RegisterUserFunction",
      {
        sharedProps: props,
        functionName: "RegisterUser",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          EVENT_BUS_NAME: sharedEventBus.eventBusName,
        },
        manifestPath: "./src/user-management/lambdas/create_user/Cargo.toml",
      }
    );
    sharedEventBus.grantPutEventsTo(lambdaFunction.function);
    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);
    this._table.grantReadWriteData(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildGetUserDetailsFunction(
    props: UserManagementApiProps
  ): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "GetUserDetailsFunction",
      {
        sharedProps: props.sharedProps,
        functionName: "GetUserDetails",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME: props.jwtSecretKeyParameter.parameterName,
        },
        manifestPath:
          "./src/user-management/lambdas/get_user_details/Cargo.toml",
      }
    );

    props.jwtSecretKeyParameter.grantRead(lambdaFunction.function);
    this._table.grantReadData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildLoginFunction(props: UserManagementApiProps): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "LoginFunction",
      {
        sharedProps: props.sharedProps,
        functionName: "Login",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME: props.jwtSecretKeyParameter.parameterName,
        },
        manifestPath: "./src/user-management/lambdas/login/Cargo.toml",
      }
    );

    props.jwtSecretKeyParameter.grantRead(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);
    this._table.grantReadData(lambdaFunction.function);

    return lambdaIntegration;
  }
}
