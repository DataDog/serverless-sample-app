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
import { HttpApi, HttpMethod, CorsHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
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
  api: HttpApi;
  private _table: ITable;

  constructor(scope: Construct, id: string, props: UserManagementApiProps) {
    super(scope, id);

    this._table = new Table(this, "UserManagementTable", {
      tableName: `${props.serviceProps.sharedProps.serviceName}-Userss-${props.serviceProps.sharedProps.environment}`,
      tableClass: TableClass.STANDARD,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
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
    const oauthWellKnownIntegration = this.buildAuthServerWellKnownFunction(
      props
    );

    this.api = new HttpApi(this, "UserManagementHttpApi", {
      apiName: `${props.serviceProps.sharedProps.serviceName}-HttpApi-${props.serviceProps.sharedProps.environment}`,
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["*"],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
      },
    });

    // Add routes using HTTP API syntax
    this.api.addRoutes({
      path: "/.well-known/oauth-authorization-server",
      methods: [HttpMethod.GET],
      integration: oauthWellKnownIntegration,
    });

    this.api.addRoutes({
      path: "/user",
      methods: [HttpMethod.POST],
      integration: registerUserIntegration,
    });

    this.api.addRoutes({
      path: "/user/{userId}",
      methods: [HttpMethod.GET],
      integration: getUserDetailsIntegration,
    });

    this.api.addRoutes({
      path: "/login",
      methods: [HttpMethod.POST],
      integration: loginIntegration,
    });

    // OAuth Authorization endpoints
    this.api.addRoutes({
      path: "/oauth/authorize",
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: oauthAuthorizeIntegration,
    });

    this.api.addRoutes({
      path: "/oauth/authorize/callback",
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: oauthAuthorizeCallbackIntegration,
    });

    // OAuth Token endpoint
    this.api.addRoutes({
      path: "/oauth/token",
      methods: [HttpMethod.POST],
      integration: oauthTokenIntegration,
    });

    // OAuth Introspect endpoint
    this.api.addRoutes({
      path: "/oauth/introspect",
      methods: [HttpMethod.POST],
      integration: oauthIntrospectIntegration,
    });

    // OAuth Revoke endpoint
    this.api.addRoutes({
      path: "/oauth/revoke",
      methods: [HttpMethod.POST],
      integration: oauthRevokeIntegration,
    });

    // OAuth Client Management endpoints - Dynamic Client Registration
    this.api.addRoutes({
      path: "/oauth/client",
      methods: [HttpMethod.POST],
      integration: oauthDcrIntegration,
    });
    // RFC 7591 - OAuth DCR should be on /oauth/register route
    this.api.addRoutes({
      path: "/oauth/register",
      methods: [HttpMethod.POST],
      integration: oauthDcrIntegration,
    });

    this.api.addRoutes({
      path: "/oauth/client/{clientId}",
      methods: [HttpMethod.GET],
      integration: oauthClientGetIntegration,
    });

    this.api.addRoutes({
      path: "/oauth/client/{clientId}",
      methods: [HttpMethod.PUT],
      integration: oauthClientUpdateIntegration,
    });

    this.api.addRoutes({
      path: "/oauth/client/{clientId}",
      methods: [HttpMethod.DELETE],
      integration: oauthClientDeleteIntegration,
    });
  }

  buildRegisterUserFunction(
    props: SharedProps,
    sharedEventBus: IEventBus
  ): HttpLambdaIntegration {
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
    const lambdaIntegration = new HttpLambdaIntegration(
      "RegisterUserIntegration",
      lambdaFunction.function
    );
    this._table.grantReadWriteData(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildGetUserDetailsFunction(
    props: UserManagementApiProps
  ): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      "GetUserDetailsIntegration",
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildLoginFunction(props: UserManagementApiProps): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      "LoginIntegration",
      lambdaFunction.function
    );
    this._table.grantReadData(lambdaFunction.function);

    return lambdaIntegration;
  }

  buildOAuthAuthorizeFunction(
    props: UserManagementApiProps
  ): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      "OAuthAuthorizeIntegration",
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildOAuthAuthorizeCallbackFunction(
    props: UserManagementApiProps
  ): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      `OAuthAuthorizeCallbackIntegration`,
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildOAuthClientDeleteFunction(
    props: UserManagementApiProps
  ): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      `OAuthClientDeleteFunctionIntegration`,
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildOAuthClientGetFunction(
    props: UserManagementApiProps
  ): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      `OAuthClientGetFunctionIntegration`,
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildOAuthClientUpdateFunction(
    props: UserManagementApiProps
  ): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      `OAuthClientUpdateFunctionIntegration`,
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildOAuthDcrFunction(props: UserManagementApiProps): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      `OAuthDcrFunctionIntegration`,
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildAuthServerWellKnownFunction(props: UserManagementApiProps): HttpLambdaIntegration {
    const lambdaFunction = new InstrumentedLambdaFunction(
      this,
      "AuthServerWellKnownFunction",
      {
        sharedProps: props.serviceProps.sharedProps,
        functionName: "OAuthMetadata",
        handler: "bootstrap",
        environment: {
          TABLE_NAME: this._table.tableName,
          JWT_SECRET_PARAM_NAME:
            props.serviceProps.getJwtSecret().parameterName,
        },
        manifestPath: "./src/user-management/lambdas/oauth_metadata/Cargo.toml",
      }
    );

    props.serviceProps.getJwtSecret().grantRead(lambdaFunction.function);
    this._table.grantReadWriteData(lambdaFunction.function);

    const lambdaIntegration = new HttpLambdaIntegration(
      `OAuthMetadataFunctionIntegration`,
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildOAuthIntrospectFunction(
    props: UserManagementApiProps
  ): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      `OAuthIntrospectFunctionIntegration`,
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildOAuthRevokeFunction(props: UserManagementApiProps): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      `OAuthRevokeFunctionIntegration`,
      lambdaFunction.function
    );

    return lambdaIntegration;
  }

  buildOAuthTokenFunction(props: UserManagementApiProps): HttpLambdaIntegration {
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

    const lambdaIntegration = new HttpLambdaIntegration(
      `OAuthTokenFunctionIntegration`,
      lambdaFunction.function
    );

    return lambdaIntegration;
  }
}
