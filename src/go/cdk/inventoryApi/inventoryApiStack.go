//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package inventoryapi

import (
	sharedprops "cdk/shared"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"os"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssecretsmanager"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"

	"github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct"
)

type InventoryApiStackProps struct {
	awscdk.StackProps
}

func NewInventoryApiStack(scope constructs.Construct, id string, props *InventoryApiStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	serviceName := "GoInventoryApi"
	env := os.Getenv("ENV")
	if len(env) <= 0 {
		env = "dev"
	}
	version := os.Getenv("VERSION")
	if len(version) <= 0 {
		version = "latest"
	}

	ddApiKeySecret := awssecretsmanager.Secret_FromSecretCompleteArn(stack, jsii.String("DDApiKeySecret"), jsii.String(os.Getenv("DD_API_KEY_SECRET_ARN")))

	eventBus := awsevents.EventBus_FromEventBusName(stack, jsii.String("SharedEventBus"), jsii.String("GoProductEventBus"))

	datadog := ddcdkconstruct.NewDatadog(
		stack,
		jsii.String("Datadog"),
		&ddcdkconstruct.DatadogProps{
			ExtensionLayerVersion:  jsii.Number(66),
			AddLayers:              jsii.Bool(true),
			Site:                   jsii.String(os.Getenv("DD_SITE")),
			ApiKeySecret:           ddApiKeySecret,
			Service:                &serviceName,
			Env:                    &env,
			Version:                &version,
			EnableColdStartTracing: jsii.Bool(true),
			CaptureLambdaPayload:   jsii.Bool(true),
			EnableDatadogTracing:   jsii.Bool(true),
			EnableDatadogASM:       jsii.Bool(true),
		})

	// The code that defines your stack goes here

	NewInventoryApi(stack, "InventoryApi", &InventoryApiProps{
		SharedProps: sharedprops.SharedProps{
			ServiceName:    serviceName,
			Env:            env,
			Version:        version,
			Datadog:        datadog,
			DDApiKeySecret: ddApiKeySecret,
		},
		sharedEventBus: eventBus,
	})

	return stack
}
