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
import { effect } from "zod";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class InstrumentedLambdaFunctionProps {
  sharedProps: SharedProps;
  handler: string;
  buildDef: string;
  outDir: string;
  functionName: string;
  environment: { [key: string]: string };
  timeout?: Duration;
  memorySize?: number;
  logLevel?: string;
  onFailure: IDestination | undefined;
}

export class InstrumentedLambdaFunction extends Construct {
  function: NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props: InstrumentedLambdaFunctionProps
  ) {
    super(scope, id);

    const pathToBuildFile = props.buildDef;
    const pathToOutputFile = props.outDir;

    const code = Code.fromCustomCommand(pathToOutputFile, [
      "node",
      pathToBuildFile,
    ]);

    this.function = new NodejsFunction(this, props.functionName, {
      runtime: Runtime.NODEJS_22_X,
      functionName: `CDK-${props.sharedProps.serviceName}-${id}-${props.sharedProps.environment}`,
      code: code,
      handler: props.handler,
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? Duration.seconds(29),
      onFailure: props.onFailure,
      environment: {
        POWERTOOLS_SERVICE_NAME: props.sharedProps.serviceName,
        POWERTOOLS_LOG_LEVEL:
          props.logLevel ?? props.sharedProps.environment === "prod"
            ? "WARN"
            : "INFO",
        ENV: props.sharedProps.environment,
        DEPLOYED_AT: new Date().toISOString(),
        BUILD_ID: props.sharedProps.version,
        TEAM: props.sharedProps.team,
        DOMAIN: props.sharedProps.domain,
        DD_DATA_STREAMS_ENABLED: "true",
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
      bundling: {
        platform: "node",
        esbuildArgs: {
          "--bundle": "true",
        },
        target: "node22",
      },
    });
    this.function.logGroup.applyRemovalPolicy(RemovalPolicy.DESTROY);

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
