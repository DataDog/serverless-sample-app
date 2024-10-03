//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package productpricingservice

import (
	sharedprops "cdk/shared"
	sharedconstructs "cdk/sharedConstructs"
	"fmt"

	"github.com/aws/aws-cdk-go/awscdk/v2/awslambdaeventsources"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssqs"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductPricingServiceProps struct {
	SharedProps         sharedprops.SharedProps
	ProductCreatedTopic awssns.ITopic
	ProductUpdatedTopic awssns.ITopic
}

func NewProductPricingService(scope constructs.Construct, id string, props *ProductPricingServiceProps) {
	priceCalculatedTopic := awssns.NewTopic(scope, jsii.String("GoPriceCalculatedTopic"), &awssns.TopicProps{})

	environmentVariables := make(map[string]*string)
	environmentVariables["ENV"] = jsii.String(props.SharedProps.Env)
	environmentVariables["PRICE_CALCULATED_TOPIC_ARN"] = jsii.String(*priceCalculatedTopic.TopicArn())

	handleProductCreatedFunction := sharedconstructs.NewInstrumentedFunction(scope, "PricingHandleProductCreated", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-pricing-service/handle-product-created/",
		FunctionName:         fmt.Sprintf("GoPricingHandlerProductCreated-%s", props.SharedProps.Env),
		EnvironmentVariables: environmentVariables,
	})

	priceCalculatedTopic.GrantPublish(handleProductCreatedFunction.Function)

	handleProductCreatedDLQ := awssqs.NewQueue(scope, jsii.String("GoPricingProductCreatedDLQ"), &awssqs.QueueProps{
		QueueName: jsii.Sprintf("GoPricingHandleCreatedDLQ-%s", props.SharedProps.Env),
	})
	handleProductCreatedFunction.Function.AddEventSource(awslambdaeventsources.NewSnsEventSource(props.ProductCreatedTopic, &awslambdaeventsources.SnsEventSourceProps{
		DeadLetterQueue: handleProductCreatedDLQ,
	}))

	handleProductUpdatedFunction := sharedconstructs.NewInstrumentedFunction(scope, "PricingHandleProductUpdated", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-pricing-service/handle-product-updated/",
		FunctionName:         fmt.Sprintf("GoPricingHandlerProductUpdated-%s", props.SharedProps.Env),
		EnvironmentVariables: environmentVariables,
	})
	priceCalculatedTopic.GrantPublish(handleProductUpdatedFunction.Function)

	handleProductUpdatedDLQ := awssqs.NewQueue(scope, jsii.String("GoPricingProductUpdatedDLQ"), &awssqs.QueueProps{
		QueueName: jsii.Sprintf("GoPricingHandleUpdatedDLQ-%s", props.SharedProps.Env),
	})
	handleProductUpdatedFunction.Function.AddEventSource(awslambdaeventsources.NewSnsEventSource(props.ProductUpdatedTopic, &awslambdaeventsources.SnsEventSourceProps{
		DeadLetterQueue: handleProductUpdatedDLQ,
	}))

	awsssm.NewStringParameter(scope, jsii.String("GoProductCreatedTopicArn"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/pricing-calculated-topic"),
		StringValue:   priceCalculatedTopic.TopicArn(),
	})

	awsssm.NewStringParameter(scope, jsii.String("GoProductCreatedTopicName"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/pricing-calculated-topic-name"),
		StringValue:   priceCalculatedTopic.TopicName(),
	})
}
