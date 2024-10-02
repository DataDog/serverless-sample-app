//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package producteventpublisher

import (
	sharedprops "cdk/shared"
	"os"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssecretsmanager"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"

	"github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct"
)

type ProductPublicEventPublisherStackProps struct {
	awscdk.StackProps
}

func NewProductPublicEventPublisherStack(scope constructs.Construct, id string, props *ProductPublicEventPublisherStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	ddApiKeySecret := awssecretsmanager.Secret_FromSecretCompleteArn(stack, jsii.String("DDApiKeySecret"), jsii.String(os.Getenv("DD_SECRET_ARN")))

	serviceName := "GoProductEventPublisher"
	env := os.Getenv("ENV")
	if len(env) <= 0 {
		env = "dev"
	}
	version := os.Getenv("VERSION")
	if len(version) <= 0 {
		version = "latest"
	}

	datadog := ddcdkconstruct.NewDatadog(
		stack,
		jsii.String("Datadog"),
		&ddcdkconstruct.DatadogProps{
			ExtensionLayerVersion:  jsii.Number(65),
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

	productCreatedTopicParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("ProductCreatedTopicParam"), jsii.String("/go/product/product-created-topic"))
	productUpdatedTopicParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("ProductUpdatedTopicParam"), jsii.String("/go/product/product-updated-topic"))
	productDeletedTopicParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("ProductDeletedTopicParam"), jsii.String("/go/product/product-deleted-topic"))

	productCreatedTopic := awssns.Topic_FromTopicArn(stack, jsii.String("ProductCreatedTopic"), productCreatedTopicParam.StringValue())
	productUpdatedTopic := awssns.Topic_FromTopicArn(stack, jsii.String("ProductUpdatedTopic"), productUpdatedTopicParam.StringValue())
	productDeletedTopic := awssns.Topic_FromTopicArn(stack, jsii.String("ProductDeletedTopic"), productDeletedTopicParam.StringValue())

	eventBus := awsevents.EventBus_FromEventBusName(stack, jsii.String("SharedEventBus"), jsii.String("GoProductEventBus"))

	NewProductPublicEventPublisherService(stack, "ProductPublicEventPublisher", &ProductPublicEventPublisherServiceProps{
		SharedProps: sharedprops.SharedProps{
			Env:         env,
			Version:     version,
			ServiceName: serviceName,
			Datadog:     datadog,
		},
		ProductCreatedTopic: productCreatedTopic,
		ProductUpdatedTopic: productUpdatedTopic,
		ProductDeletedTopic: productDeletedTopic,
		SharedEventBus:      eventBus,
	})

	return stack
}
