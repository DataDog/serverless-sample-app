//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package productapiworker

import (
	sharedprops "cdk/shared"
	"os"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsdynamodb"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssecretsmanager"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"

	"github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct"
)

type ProductApiWorkerStackProps struct {
	awscdk.StackProps
}

func NewProductApiWorkerStack(scope constructs.Construct, id string, props *ProductApiWorkerStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	ddApiKeySecret := awssecretsmanager.Secret_FromSecretCompleteArn(stack, jsii.String("DDApiKeySecret"), jsii.String(os.Getenv("DD_API_KEY_SECRET_ARN")))

	serviceName := "GoProductApi"
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

	productPricingChangedTopicParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("ProductPricingChangedTopicParam"), jsii.String("/go/product/pricing-calculated-topic"))
	productPricingChangedTopic := awssns.Topic_FromTopicArn(stack, jsii.String("ProductPricingChangedTopic"), productPricingChangedTopicParam.StringValue())

	stockUpdatedTopicParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("ProductStockUpdatedTopicParam"), jsii.String("/go/product/inventory-stock-updated-topic"))
	stockUpdatedTopic := awssns.Topic_FromTopicArn(stack, jsii.String("ProductStockUpdatedTopic"), stockUpdatedTopicParam.StringValue())

	productTableParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("ProductTableNameParam"), jsii.String("/go/product/table-name"))
	productTable := awsdynamodb.Table_FromTableName(stack, jsii.String("ProductTable"), productTableParam.StringValue())

	NewProductApiWorkerService(stack, "ProductApiWorkerService", &ProductApiWorkerServiceProps{
		SharedProps: sharedprops.SharedProps{
			Env:         env,
			Version:     version,
			ServiceName: serviceName,
			Datadog:     datadog,
		},
		ProductPricingChangedTopic: productPricingChangedTopic,
		ProductStockUpdatedTopic:   stockUpdatedTopic,
		ProductTable:               productTable,
	})

	return stack
}
