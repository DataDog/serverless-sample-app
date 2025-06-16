//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Code, IDestination, Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration, RemovalPolicy, Tags } from "aws-cdk-lib";
import { Alias } from "aws-cdk-lib/aws-kms";
import { SharedProps } from "./sharedFunctionProps";
import path = require("path");
import { RustFunction } from "cargo-lambda-cdk";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class InstrumentedLambdaFunctionProps {
  sharedProps: SharedProps;
  handler: string;
  manifestPath: string;
  functionName: string;
  environment: { [key: string]: string };
}

export class InstrumentedLambdaFunction extends Construct {
  function: RustFunction;

  constructor(
    scope: Construct,
    id: string,
    props: InstrumentedLambdaFunctionProps
  ) {
    super(scope, id);

    this.function = new RustFunction(this, props.functionName, {
      functionName: `CDK-${props.sharedProps.serviceName}-${id}-${props.sharedProps.environment}`,
      manifestPath: props.manifestPath,
      memorySize: 256,
      environment: {
        DEPLOYED_AT: new Date().toISOString(),
        BUILD_ID: props.sharedProps.version,
        TEAM: props.sharedProps.team,
        DOMAIN: props.sharedProps.domain,
        ENV: props.sharedProps.environment,
        RUST_LOG: "info",
        DD_APM_REPLACE_TAGS: `[
                    {
                      "name": "function.request.headers.Authorization",
                      "pattern": "(?s).*",
                      "repl": "****"
                    },
                    {
                      "name": "function.request.multiValueHeaders.Authorization",
                      "pattern": "(?s).*",
                      "repl": "****"
                    }
                ]`,
        ...props.environment,
      },
    });

    const kmsAlias = Alias.fromAliasName(this, "SSMAlias", "aws/ssm");
    kmsAlias.grantDecrypt(this.function);

    Tags.of(this.function).add("service", props.sharedProps.serviceName);
    Tags.of(this.function).add("env", props.sharedProps.environment);
    Tags.of(this.function).add("version", props.sharedProps.version);

    // The Datadog extension sends log data to Datadog using the telemetry API, disabling CloudWatch prevents 'double paying' for logs
    if (process.env.ENABLE_CLOUDWATCH_LOGS != "Y") {
      this.function.addToRolePolicy(
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
    }

    props.sharedProps.datadogConfiguration.addLambdaFunctions([this.function]);
  }
}
