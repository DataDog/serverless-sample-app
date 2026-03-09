//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { PricingServiceProps } from "./pricingServiceProps";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Alias } from "aws-cdk-lib/aws-kms";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface ApiProps {
  serviceProps: PricingServiceProps;
  jwtSecret: IStringParameter;
}

export class Api extends Construct {
  api: RestApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const calculatePricingIntegration =
      this.buildCalculatePricingFunction(props);

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

    const productResource = this.api.root.addResource("pricing");
    productResource.addMethod("POST", calculatePricingIntegration);
  }

  buildCalculatePricingFunction(props: ApiProps): LambdaIntegration {
    const isWorkshopBuild = process.env.WORKSHOP_BUILD === "true";

    const entry = isWorkshopBuild
      ? "./src/pricing-api/workshop/calculatePricingFunction.ts"
      : "./src/pricing-api/adapters/calculatePricingFunction.ts";

    // Workshop builds are uninstrumented — no dd-trace.
    // Production builds exclude dd-trace so the Datadog Lambda layer provides it at runtime.
    const externalModules = isWorkshopBuild
      ? ["@aws-sdk/client-eventbridge", "@aws-sdk/client-ssm"]
      : [
          "dd-trace",
          "@datadog/native-metrics",
          "@datadog/pprof",
          "@datadog/native-appsec",
          "@datadog/native-iast-taint-tracking",
          "@datadog/native-iast-rewriter",
          "graphql/language/visitor",
          "graphql/language/printer",
          "graphql/utilities",
          "@aws-sdk/client-eventbridge",
          "@aws-sdk/client-ssm",
        ];

    const calculatePricingFunction = new NodejsFunction(
      this,
      "CalculatePricingFunction",
      {
        runtime: Runtime.NODEJS_22_X,
        functionName: `CDK-CalculatePricing-${
          props.serviceProps.getSharedProps().environment
        }`,
        entry,
        handler: "handler",
        memorySize: 512,
        timeout: Duration.seconds(29),
        environment: {
          ENV: props.serviceProps.getSharedProps().environment,
        },
        bundling: {
          platform: "node",
          target: "node22",
          minify: true,
          keepNames: true,
          externalModules,
        },
      }
    );

    // Paste Datadog configuration from the workshop here.
    // Add Datadog configuration to your Lambda function
    props.serviceProps
      .getSharedProps()
      .datadogConfiguration?.addLambdaFunctions([calculatePricingFunction]);

    // The Datadog extension sends log data to Datadog using the telemetry API. So you no longer need to use CloudWatch for viewing these logs. Disabling it prevents  'double paying' for logs.
    calculatePricingFunction.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["arn:aws:logs:*:*:*"],
        effect: Effect.DENY,
      })
    );

    const kmsAlias = Alias.fromAliasName(this, "SSMAlias", "aws/ssm");
    kmsAlias.grantDecrypt(calculatePricingFunction);

    const calculatePricingIntegration = new LambdaIntegration(
      calculatePricingFunction
    );

    return calculatePricingIntegration;
  }
}
