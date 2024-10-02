//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package shared

import (
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type SharedResourceStackProps struct {
	awscdk.StackProps
}

func NewSharedResourceStack(scope constructs.Construct, id string, props *SharedResourceStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	eventBus := awsevents.NewEventBus(stack, jsii.String("GoProductEventBus"), &awsevents.EventBusProps{
		EventBusName: jsii.String("GoProductEventBus"),
	})

	awsssm.NewStringParameter(stack, jsii.String("GoEventBus"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/shared/event-bus-name"),
		StringValue:   eventBus.EventBusName(),
	})

	return stack
}
