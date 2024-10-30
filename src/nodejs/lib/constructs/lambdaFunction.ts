//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { Tags } from "aws-cdk-lib";
import { Alias } from "aws-cdk-lib/aws-kms";
import { SharedProps } from "./sharedFunctionProps";
import path = require("path");

export class InstrumentedLambdaFunctionProps {
  sharedProps: SharedProps;
  handler: string;
  buildDef: string;
  outDir: string;
  functionName: string;
  environment: {[key: string]: string}
}

export class InstrumentedLambdaFunction extends Construct {
  function: NodejsFunction;

  constructor(scope: Construct, id: string, props: InstrumentedLambdaFunctionProps) {
    super(scope, id);

    const pathToBuildFile = props.buildDef;
    const pathToOutputFile = props.outDir;

    const code = Code.fromCustomCommand(
      pathToOutputFile,
      ['node', pathToBuildFile],
    );

    this.function = new NodejsFunction(this, props.functionName, {
      runtime: Runtime.NODEJS_20_X,
      functionName: `${id}-${props.sharedProps.environment}`,
      code: code,
      handler: props.handler,
      memorySize: 512,
      environment: {
        POWERTOOLS_SERVICE_NAME: props.sharedProps.serviceName,
        POWERTOOLS_LOG_LEVEL: 'INFO',
        ENV: props.sharedProps.environment,
        DD_EXTENSION_VERSION: 'next',
        DD_SERVERLESS_APPSEC_ENABLED: "true",
        DD_IAST_ENABLED: "true",
        ...props.environment
      },
      bundling: {
        platform: 'node',
        esbuildArgs: {
          "--bundle": "true"
        },
        target: 'node20'
      }
    });

    const kmsAlias = Alias.fromAliasName(this, "SSMAlias", "aws/ssm");
    kmsAlias.grantDecrypt(this.function);

    Tags.of(this.function).add("service", props.sharedProps.serviceName);
    Tags.of(this.function).add("env", props.sharedProps.environment);
    Tags.of(this.function).add("version", props.sharedProps.version);

    props.sharedProps.datadogConfiguration.addLambdaFunctions([this.function]);
  }
}
