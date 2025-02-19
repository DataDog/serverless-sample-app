//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Code, IDestination, Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration, Tags } from "aws-cdk-lib";
import { Alias } from "aws-cdk-lib/aws-kms";
import { SharedProps } from "./sharedFunctionProps";
import path = require("path");
import {RustFunction} from "cargo-lambda-cdk";

export class InstrumentedLambdaFunctionProps {
    sharedProps: SharedProps;
    handler: string;
    manifestPath: string;
    functionName: string;
    environment: {[key: string]: string}
}

export class InstrumentedLambdaFunction extends Construct {
    function: RustFunction;

    constructor(scope: Construct, id: string, props: InstrumentedLambdaFunctionProps) {
        super(scope, id);

        this.function = new RustFunction(this, props.functionName, {
            functionName: `CDK-${props.sharedProps.serviceName}-${id}-${props.sharedProps.environment}`,
            manifestPath: props.manifestPath,
            memorySize: 256,
            environment: {
                ENV: props.sharedProps.environment,
                RUST_LOG: "info",
                ...props.environment
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
