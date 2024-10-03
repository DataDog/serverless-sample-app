//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package productapiworker

import (
	sharedprops "cdk/shared"
	sharedconstructs "cdk/sharedConstructs"
	"fmt"

	"github.com/aws/aws-cdk-go/awscdk/v2/awsdynamodb"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambdaeventsources"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssqs"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductApiWorkerServiceProps struct {
	SharedProps                sharedprops.SharedProps
	ProductPricingChangedTopic awssns.ITopic
	ProductTable               awsdynamodb.ITable
}

func NewProductApiWorkerService(scope constructs.Construct, id string, props *ProductApiWorkerServiceProps) {
	environmentVariables := make(map[string]*string)
	environmentVariables["TABLE_NAME"] = jsii.String(*props.ProductTable.TableName())

	handlePricingChangedFunction := sharedconstructs.NewInstrumentedFunction(scope, "ProductApiHandlerPricingChanged", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/handle-pricing-changed/",
		FunctionName:         fmt.Sprintf("ProductApiHandlePricingChanged-%s", props.SharedProps.Env),
		EnvironmentVariables: environmentVariables,
	})

	props.ProductTable.GrantReadWriteData(handlePricingChangedFunction.Function)

	handlePricingChangedDLQ := awssqs.NewQueue(scope, jsii.String("GoHandlePricingChangedDLQ"), &awssqs.QueueProps{
		QueueName: jsii.Sprintf("GoHandlePricingChangedDLQ-%s", props.SharedProps.Env),
	})
	handlePricingChangedFunction.Function.AddEventSource(awslambdaeventsources.NewSnsEventSource(props.ProductPricingChangedTopic, &awslambdaeventsources.SnsEventSourceProps{
		DeadLetterQueue: handlePricingChangedDLQ,
	}))
}
