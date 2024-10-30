//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package inventoryorderingservice

import (
	sharedprops "cdk/shared"
	sharedconstructs "cdk/sharedConstructs"
	"fmt"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambdaeventsources"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslogs"
	"github.com/aws/aws-cdk-go/awscdk/v2/awss3assets"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssqs"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsstepfunctions"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type InventoryOrderingServiceProps struct {
	SharedProps       sharedprops.SharedProps
	ProductAddedTopic awssns.ITopic
}

func NewInventoryOrderingService(scope constructs.Construct, id string, props *InventoryOrderingServiceProps) {
	workflowLogGroup := awslogs.NewLogGroup(scope, jsii.String("InventoryOrderingWorkflowLogGroup"), &awslogs.LogGroupProps{
		LogGroupName:  jsii.Sprintf("/aws/vendedlogs/states/GoInventoryOrderingServiceLogGroup-%s", props.SharedProps.Env),
		RemovalPolicy: awscdk.RemovalPolicy_DESTROY,
	})

	workflow := awsstepfunctions.NewStateMachine(scope, jsii.Sprintf("GoInventoryOrderingWorkflow-%s", props.SharedProps.Env), &awsstepfunctions.StateMachineProps{
		StateMachineName: jsii.Sprintf("GoInventoryOrderingWorkflow-%s", props.SharedProps.Env),
		DefinitionBody:   awsstepfunctions.DefinitionBody_FromFile(jsii.String("./inventory-ordering-service/workflows/ordering-workflow.asl.json"), &awss3assets.AssetOptions{}),
		Logs: &awsstepfunctions.LogOptions{
			Destination:          workflowLogGroup,
			IncludeExecutionData: jsii.Bool(true),
			Level:                awsstepfunctions.LogLevel_ALL,
		},
	})
	awscdk.Tags_Of(workflow).Add(jsii.String("DD_ENHANCED_METRICS"), jsii.String("true"), &awscdk.TagProps{})
	awscdk.Tags_Of(workflow).Add(jsii.String("DD_TRACE_ENABLED"), jsii.String("true"), &awscdk.TagProps{})

	environmentVariables := make(map[string]*string)
	environmentVariables["ORDERING_SERVICE_WORKFLOW_ARN"] = jsii.String(*workflow.StateMachineArn())

	startWorkflowFunction := sharedconstructs.NewInstrumentedFunction(scope, "GoInventoryOrdering", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/inventory-ordering-service/handle-product-added/",
		FunctionName:         fmt.Sprintf("GoInventoryOrdering-%s", props.SharedProps.Env),
		EnvironmentVariables: environmentVariables,
	})
	startWorkflowFunctionDLQ := awssqs.NewQueue(scope, jsii.String("GoInventoryOrderingDLQ"), &awssqs.QueueProps{
		QueueName: jsii.Sprintf("GoInventoryOrderingDLQ-%s", props.SharedProps.Env),
	})
	startWorkflowFunction.Function.AddEventSource(awslambdaeventsources.NewSnsEventSource(props.ProductAddedTopic, &awslambdaeventsources.SnsEventSourceProps{
		DeadLetterQueue: startWorkflowFunctionDLQ,
	}))

	workflow.GrantStartExecution(startWorkflowFunction.Function)

	awsssm.NewStringParameter(scope, jsii.String("GoProductApiEndpoint"), &awsssm.StringParameterProps{
		ParameterName: jsii.String(fmt.Sprintf("/go/%s/inventory-ordering/state-machine-arn", props.SharedProps.Env)),
		StringValue:   jsii.String(*workflow.StateMachineArn()),
	})
}
