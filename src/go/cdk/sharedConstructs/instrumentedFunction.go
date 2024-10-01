package sharedconstructs

import (
	"cdk/shared"
	"os"

	"github.com/aws/aws-cdk-go/awscdk/v2/awsiam"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambda"
	"github.com/aws/aws-cdk-go/awscdklambdagoalpha/v2"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type InstrumentedFunctionProps struct {
	SharedProps          shared.SharedProps
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

	for k, v := range props.EnvironmentVariables {
		defaultEnvironmentVariables[k] = v
	}

	if props.MemorySize <= 128 {
		props.MemorySize = 512
	}

	function.Function = awscdklambdagoalpha.NewGoFunction(scope, jsii.String(props.FunctionName), &awscdklambdagoalpha.GoFunctionProps{
		Entry:        jsii.String(props.Entry),
		FunctionName: jsii.Sprintf("%s-%s", props.FunctionName, props.SharedProps.Env),
		Runtime:      awslambda.Runtime_PROVIDED_AL2023(),
		MemorySize:   jsii.Number(props.MemorySize),
		Environment:  &defaultEnvironmentVariables,
		Architecture: awslambda.Architecture_ARM_64(),
	})

	// Disable logging to CloudWatch, the Datadog extension will ship logs directly to Datadog
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
