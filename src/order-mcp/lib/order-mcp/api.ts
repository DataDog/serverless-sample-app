//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  IdentitySource,
  LambdaIntegration,
  ProxyResource,
  RequestAuthorizer,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { OrderMcpServiceProps } from "./orderMcpServiceProps";
import {
  DynamoEventSource,
  SqsDlq,
} from "aws-cdk-lib/aws-lambda-event-sources";
import {
  IFunction,
  LayerVersion,
  StartingPosition,
} from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { get } from "http";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface ApiProps {
  serviceProps: OrderMcpServiceProps;
  ddApiKeySecret: ISecret;
  jwtSecret: IStringParameter;
}

export class Api extends Construct {
  api: RestApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const orderMcpFunction = this.buildOrderMcpFunction(props);
    const customAuthorizerFunction = this.buildCustomAuthorizerFunction(props);

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

    const authorizer = new RequestAuthorizer(this, "CustomAuthorizer", {
      handler: customAuthorizerFunction,
      identitySources: [IdentitySource.header("Authorization")],
      authorizerName: "OrderMcpAuthorizer",
      resultsCacheTtl: Duration.seconds(30),
    });

    const proxyResource = new ProxyResource(this, "ProxyResource", {
      parent: this.api.root,
      anyMethod: true,
      defaultIntegration: orderMcpFunction,
      defaultMethodOptions: {
        authorizer: authorizer,
      },
    });
  }

  buildOrderMcpFunction(props: ApiProps): LambdaIntegration {
    const mcpServerFunction = new InstrumentedLambdaFunction(
      this,
      "OrderMcpFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "OrderMcpFunction",
        handler: "run.sh",
        environment: {
          JWT_SECRET_PARAM_NAME: props.jwtSecret.parameterName,
          DD_TRACE_PARTIAL_FLUSH_MIN_SPANS: "1",
          DD_TRACE_PARTIAL_FLUSH_ENABLED: "false",
          AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
          AWS_LWA_PORT: "3000",
        },
        outDir: "./out/order-mcp/order-mcp.zip",
        onFailure: undefined,
        layers: [
          LayerVersion.fromLayerVersionArn(
            this,
            "LWALayer",
            `arn:aws:lambda:${
              Stack.of(this).region
            }:753240598075:layer:LambdaAdapterLayerX86:25`
          ),
        ],
      }
    );
    const mcpIntegration = new LambdaIntegration(mcpServerFunction.function);
    props.jwtSecret.grantRead(mcpServerFunction.function);

    mcpServerFunction.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ],
        resources: [
          `arn:aws:ssm:${Stack.of(this).region}:${
            Stack.of(this).account
          }:parameter/${
            props.serviceProps.getSharedProps().environment
          }/OrdersService/api-endpoint`,
          `arn:aws:ssm:${Stack.of(this).region}:${
            Stack.of(this).account
          }:parameter/${
            props.serviceProps.getSharedProps().environment
          }/ProductService/api-endpoint`,
        ],
      })
    );

    return mcpIntegration;
  }

  buildCustomAuthorizerFunction(props: ApiProps): IFunction {
    const customAuthorizer = new InstrumentedLambdaFunction(
      this,
      "OrderMcpAuthorizerFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "OrderMcpAuthorizerFunction",
        handler: "index.handler",
        environment: {
          JWT_SECRET_PARAM_NAME: props.jwtSecret.parameterName,
        },
        outDir: "./out/authorizerFunction/authorizerFunction.zip",
        onFailure: undefined,
        layers: [],
      }
    );

    props.jwtSecret.grantRead(customAuthorizer.function);

    return customAuthorizer.function;
  }
}
