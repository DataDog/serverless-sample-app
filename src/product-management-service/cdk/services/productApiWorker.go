//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package services

import (
	sharedconstructs "cdk/sharedConstructs"

	"github.com/aws/aws-cdk-go/awscdk/v2/awsdynamodb"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambdaeventsources"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssqs"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductBackgroundServiceProps struct {
	ServiceProps             ProductServiceProps
	ProductStockUpdatedTopic awssns.ITopic
	PriceCalculatedTopic     awssns.ITopic
	ProductTable             awsdynamodb.ITable
}

func NewProductBackgroundServices(scope constructs.Construct, id string, props *ProductBackgroundServiceProps) {
	environmentVariables := make(map[string]*string)
	environmentVariables["TABLE_NAME"] = jsii.String(*props.ProductTable.TableName())

	handlePricingChangedFunction := sharedconstructs.NewInstrumentedFunction(scope, "ProductApiHandlerPricingChanged", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		Entry:                "../src/product-api/handle-pricing-changed/",
		FunctionName:         "HandlePricingChanged",
		EnvironmentVariables: environmentVariables,
	})

	props.ProductTable.GrantReadWriteData(handlePricingChangedFunction.Function)

	handlePriceCalculatedDLQ := awssqs.NewQueue(scope, jsii.String("HandlePriceCalculatedDLQ"), &awssqs.QueueProps{
		QueueName: jsii.Sprintf("HandlePriceCalculatedDLQ-%s", props.ServiceProps.SharedProps.Env),
	})
	handlePricingChangedFunction.Function.AddEventSource(awslambdaeventsources.NewSnsEventSource(props.PriceCalculatedTopic, &awslambdaeventsources.SnsEventSourceProps{
		DeadLetterQueue: handlePriceCalculatedDLQ,
	}))

	handleStockUpdatedFunction := sharedconstructs.NewInstrumentedFunction(scope, "ProductStockUpdatedHandler", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		Entry:                "../src/product-api/handle-stock-updated/",
		FunctionName:         "HandleStockUpdated",
		EnvironmentVariables: environmentVariables,
	})

	props.ProductTable.GrantReadWriteData(handleStockUpdatedFunction.Function)

	handleStockUpdatedDLQ := awssqs.NewQueue(scope, jsii.String("HandleStockUpdatedDLQ"), &awssqs.QueueProps{
		QueueName: jsii.Sprintf("HandleStockUpdatedDLQ-%s", props.ServiceProps.SharedProps.Env),
	})
	handleStockUpdatedFunction.Function.AddEventSource(awslambdaeventsources.NewSnsEventSource(props.ProductStockUpdatedTopic, &awslambdaeventsources.SnsEventSourceProps{
		DeadLetterQueue: handleStockUpdatedDLQ,
	}))
}
