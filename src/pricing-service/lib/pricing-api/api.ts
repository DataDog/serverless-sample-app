//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { RemovalPolicy } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { PricingServiceProps } from "./pricingServiceProps";

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
    const calculatePricingFunction = new InstrumentedLambdaFunction(
      this,
      "CalculatePricingFunction",
      {
        sharedProps: props.serviceProps.getSharedProps(),
        functionName: "CalculatePricing",
        handler: "index.handler",
        environment: {
          JWT_SECRET_PARAM_NAME: props.jwtSecret.parameterName,
        },
        buildDef: "./src/pricing-api/adapters/buildCalculatePricingFunction.js",
        outDir: "./out/calculatePricingFunction",
        onFailure: undefined,
      }
    );
    const calculatePricingIntegration = new LambdaIntegration(
      calculatePricingFunction.function
    );
    props.jwtSecret.grantRead(calculatePricingFunction.function);

    return calculatePricingIntegration;
  }
}
