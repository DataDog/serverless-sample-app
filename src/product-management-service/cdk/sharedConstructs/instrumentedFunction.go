//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package sharedconstructs

import (
	"fmt"
	"os"

	"github.com/aws/aws-cdk-go/awscdk/v2/awsiam"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambda"
	"github.com/aws/aws-cdk-go/awscdklambdagoalpha/v2"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type InstrumentedFunctionProps struct {
	SharedProps          SharedProps
	FunctionName         string
	Entry                string
	EnvironmentVariables map[string]*string
	MemorySize           float64
}

type InstrumentedFunction struct {
	Function awslambda.IFunction
}

func NewInstrumentedFunction(scope constructs.Construct, id string, props *InstrumentedFunctionProps) InstrumentedFunction {
	function := InstrumentedFunction{}

	defaultEnvironmentVariables := make(map[string]*string)
	defaultEnvironmentVariables["ENV"] = jsii.String(props.SharedProps.Env)
	defaultEnvironmentVariables["DD_DATA_STREAMS_ENABLED"] = jsii.String("true")
	defaultEnvironmentVariables["DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED"] = jsii.String("true")
	defaultEnvironmentVariables["DD_FLUSH_TO_LOG"] = jsii.String("true")
	defaultEnvironmentVariables["DD_TRACE_ENABLED"] = jsii.String("true")
	defaultEnvironmentVariables["DD_APM_REPLACE_TAGS"] = jsii.String(`[
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
]`)

	for k, v := range props.EnvironmentVariables {
		defaultEnvironmentVariables[k] = v
	}

	if props.MemorySize <= 128 {
		props.MemorySize = 512
	}

	functionName := fmt.Sprintf("CDK-%s-%s-%s", props.SharedProps.ServiceName, props.FunctionName, props.SharedProps.Env)

	if len(functionName) > 64 {
		functionName = functionName[0:64]
	}

	function.Function = awscdklambdagoalpha.NewGoFunction(scope, jsii.String(props.FunctionName), &awscdklambdagoalpha.GoFunctionProps{
		Entry:        jsii.String(props.Entry),
		FunctionName: jsii.String(functionName),
		Runtime:      awslambda.Runtime_PROVIDED_AL2023(),
		MemorySize:   jsii.Number(props.MemorySize),
		Environment:  &defaultEnvironmentVariables,
		Architecture: awslambda.Architecture_ARM_64(),
		Tracing:      awslambda.Tracing_ACTIVE,
	})

	// The Datadog extension sends log data to Datadog using the telemetry API, disabling CloudWatch prevents 'double paying' for logs
	if os.Getenv("ENABLE_CLOUDWATCH_LOGS") != "Y" {
		function.Function.AddToRolePolicy(awsiam.NewPolicyStatement(&awsiam.PolicyStatementProps{
			Actions:   jsii.Strings("logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"),
			Resources: jsii.Strings("arn:aws:logs:*:*:*"),
			Effect:    awsiam.Effect_DENY,
		}))
	}

	props.SharedProps.Datadog.AddLambdaFunctions(&[]interface{}{function.Function}, nil)

	return function
}
