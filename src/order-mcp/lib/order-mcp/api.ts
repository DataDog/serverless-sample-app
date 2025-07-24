//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { Duration, Stack } from "aws-cdk-lib";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { OrderMcpServiceProps } from "./orderMcpServiceProps";
import {
  IFunction,
  LayerVersion,
} from "aws-cdk-lib/aws-lambda";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  HttpApi,
  HttpRoute,
  HttpMethod,
  CorsHttpMethod,
  HttpRouteKey,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

export interface ApiProps {
  serviceProps: OrderMcpServiceProps;
  ddApiKeySecret: ISecret;
  jwtSecret: IStringParameter;
}

export class Api extends Construct {
  api: HttpApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const orderMcpFunction = this.buildOrderMcpFunction(props);
    const customAuthorizerFunction = this.buildCustomAuthorizerFunction(props);

    this.api = new HttpApi(
      this,
      `${props.serviceProps.getSharedProps().serviceName}-HTTP-${
        props.serviceProps.getSharedProps().environment
      }`,
      {
        apiName: `${props.serviceProps.getSharedProps().serviceName}-API-${props.serviceProps.getSharedProps().environment}`,
        corsPreflight: {
          allowHeaders: ["*"],
          allowMethods: [
            CorsHttpMethod.GET,
            CorsHttpMethod.POST,
            CorsHttpMethod.PUT,
            CorsHttpMethod.DELETE,
            CorsHttpMethod.OPTIONS,
          ],
          allowOrigins: ["*"],
          maxAge: Duration.days(10),
        },
      }
    );

    // Create Lambda integration
    const integration = new HttpLambdaIntegration(
      "OrderMcpIntegration",
      orderMcpFunction
    );

    // Add {proxy+} route that catches all paths and methods
    const proxyRoute = new HttpRoute(this, "ProxyRoute", {
      httpApi: this.api,
      routeKey: HttpRouteKey.with("/{proxy+}", HttpMethod.ANY),
      integration: integration,
    });

    // Optional: Add a root route as well
    const root = new HttpRoute(this, "RootRoute", {
      httpApi: this.api,
      routeKey: HttpRouteKey.with("/", HttpMethod.ANY),
      integration: integration,
    });
  }

  buildOrderMcpFunction(props: ApiProps): IFunction {
    const mcpServerFunction = new InstrumentedLambdaFunction(
      this,
      "OrderMcpFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "OrderMcpFunction",
        handler: "run.sh",
        environment: {
          AUTH_SERVER_PARAMETER_NAME: `/${
            props.serviceProps.getSharedProps().environment
          }/Users/api-endpoint`,
          MCP_SERVER_ENDPOINT_PARAMETER_NAME: `/${
            props.serviceProps.getSharedProps().environment
          }/OrderMcpService/api-endpoint`,
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

    // Grant permissions and setup function
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
          `arn:aws:ssm:${Stack.of(this).region}:${
            Stack.of(this).account
          }:parameter/${
            props.serviceProps.getSharedProps().environment
          }/Users/api-endpoint`,
          `arn:aws:ssm:${Stack.of(this).region}:${
            Stack.of(this).account
          }:parameter/${
            props.serviceProps.getSharedProps().environment
          }/OrderMcpService/api-endpoint`,
        ],
      })
    );

    return mcpServerFunction.function;
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
