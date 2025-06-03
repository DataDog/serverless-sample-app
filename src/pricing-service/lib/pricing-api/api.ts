//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { PricingServiceProps } from "./pricingServiceProps";
import { Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Alias } from "aws-cdk-lib/aws-kms";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface ApiProps {
  serviceProps: PricingServiceProps;
  ddApiKeySecret: ISecret;
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
    // The function uses ESBuild, this path is to a custom command that runs the build
    const pathToBuildFile =
      "./src/pricing-api/adapters/buildCalculatePricingFunction.js";
    const pathToOutputFile = "./out/calculatePricingFunction";

    const code = Code.fromCustomCommand(pathToOutputFile, [
      "node",
      pathToBuildFile,
    ]);

    const calculatePricingFunction = new NodejsFunction(
      this,
      "CalculatePricingFunction",
      {
        runtime: Runtime.NODEJS_22_X,
        functionName: `CDK-CalculatePricing-${
          props.serviceProps.getSharedProps().environment
        }`,
        code: code,
        handler: "index.handler",
        memorySize: 512,
        timeout: Duration.seconds(29),
        environment: {
          ENV: props.serviceProps.getSharedProps().environment,
        },
        bundling: {
          platform: "node",
          esbuildArgs: {
            "--bundle": "true",
          },
          target: "node22",
        },
      }
    );
    calculatePricingFunction.logGroup.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Paste Datadog configuration from the workshop here.

    const kmsAlias = Alias.fromAliasName(this, "SSMAlias", "aws/ssm");
    kmsAlias.grantDecrypt(calculatePricingFunction);

    const calculatePricingIntegration = new LambdaIntegration(
      calculatePricingFunction
    );

    return calculatePricingIntegration;
  }
}
