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
import { UserManagementServiceProps } from "./userManagementServiceProps";

export interface UserManagementApiProps {
  serviceProps: UserManagementServiceProps;
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
      tableName: `${props.serviceProps.sharedProps.serviceName}-Users-${props.serviceProps.sharedProps.environment}`,
      tableClass: TableClass.STANDARD,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const registerUserIntegration = this.buildRegisterUserFunction(
      props.serviceProps.sharedProps,
      props.serviceProps.getPublisherBus()
    );
    const loginIntegration = this.buildLoginFunction(props);
    const getUserDetailsIntegration = this.buildGetUserDetailsFunction(props);

    const oauthAuthorizeIntegration = this.buildOAuthAuthorizeFunction(props);
    const oauthAuthorizeCallbackIntegration =
      this.buildOAuthAuthorizeCallbackFunction(props);
    const oauthClientDeleteIntegration =
      this.buildOAuthClientDeleteFunction(props);
    const oauthClientGetIntegration = this.buildOAuthClientGetFunction(props);
    const oauthClientUpdateIntegration =
      this.buildOAuthClientUpdateFunction(props);
    const oauthDcrIntegration = this.buildOAuthDcrFunction(props);
    const oauthIntrospectIntegration = this.buildOAuthIntrospectFunction(props);
    const oauthRevokeIntegration = this.buildOAuthRevokeFunction(props);
    const oauthTokenIntegration = this.buildOAuthTokenFunction(props);

    this.api = new RestApi(this, "UserManagementApi", {
      restApiName: `${props.serviceProps.sharedProps.serviceName}-Api-${props.serviceProps.sharedProps.environment}`,
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

    // OAuth endpoints
    const oauthResource = this.api.root.addResource("oauth");
    
    // OAuth Authorization endpoints
    const authorizeResource = oauthResource.addResource("authorize");
    authorizeResource.addMethod("GET", oauthAuthorizeIntegration);
    authorizeResource.addMethod("POST", oauthAuthorizeIntegration);
    
    const callbackResource = authorizeResource.addResource("callback");
    callbackResource.addMethod("GET", oauthAuthorizeCallbackIntegration);
    callbackResource.addMethod("POST", oauthAuthorizeCallbackIntegration);

    // OAuth Token endpoints
    const tokenResource = oauthResource.addResource("token");
    tokenResource.addMethod("POST", oauthTokenIntegration);

    // OAuth Introspect endpoint
    const introspectResource = oauthResource.addResource("introspect");
    introspectResource.addMethod("POST", oauthIntrospectIntegration);

    // OAuth Revoke endpoint
    const revokeResource = oauthResource.addResource("revoke");
    revokeResource.addMethod("POST", oauthRevokeIntegration);

    // OAuth Client Management endpoints
    const clientResource = oauthResource.addResource("client");
    clientResource.addMethod("POST", oauthDcrIntegration); // Dynamic Client Registration
    
    const clientIdResource = clientResource.addResource("{clientId}");
    clientIdResource.addMethod("GET", oauthClientGetIntegration);
    clientIdResource.addMethod("PUT", oauthClientUpdateIntegration);
    clientIdResource.addMethod("DELETE", oauthClientDeleteIntegration);
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
        sharedProps: props.serviceProps.sharedProps,
        functionName: "GetUserDetails",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath:
          "./src/user-management/lambdas/get_user_details/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildLoginFunction(props: UserManagementApiProps): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "LoginFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "Login",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath: "./src/user-management/lambdas/login/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);
    this._table.grantReadData(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthAuthorizeFunction(
    props: UserManagementApiProps
  ): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "OAuthAuthorizeFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthAuthorize",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath:
          "./src/user-management/lambdas/oauth_authorize/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadWriteData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthAuthorizeCallbackFunction(
    props: UserManagementApiProps
  ): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "OAuthAuthorizeCallbackFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthAuthorizeCallback",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath:
          "./src/user-management/lambdas/oauth_authorize_callback/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadWriteData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthClientDeleteFunction(
    props: UserManagementApiProps
  ): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "OAuthClientDeleteFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthClientDelete",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath:
          "./src/user-management/lambdas/oauth_client_delete/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadWriteData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthClientGetFunction(
    props: UserManagementApiProps
  ): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "OAuthClientGetFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthClientGet",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath:
          "./src/user-management/lambdas/oauth_client_get/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthClientUpdateFunction(
    props: UserManagementApiProps
  ): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "OAuthClientUpdateFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthClientUpdate",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath:
          "./src/user-management/lambdas/oauth_client_update/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadWriteData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthDcrFunction(props: UserManagementApiProps): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "OAuthDcrFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthDcr",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath: "./src/user-management/lambdas/oauth_dcr/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadWriteData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthIntrospectFunction(
    props: UserManagementApiProps
  ): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "OAuthIntrospectFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthIntrospect",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath:
          "./src/user-management/lambdas/oauth_introspect/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthRevokeFunction(props: UserManagementApiProps): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "OAuthRevokeFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthRevoke",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath: "./src/user-management/lambdas/oauth_revoke/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadWriteData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthTokenFunction(props: UserManagementApiProps): LambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "OAuthTokenFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthToken",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath: "./src/user-management/lambdas/oauth_token/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadWriteData(lambdaFunction.function);

    const lambdaIntegration = new LambdaIntegration(lambdaFunction.function);

    return lambdaIntegration;
  }
}
