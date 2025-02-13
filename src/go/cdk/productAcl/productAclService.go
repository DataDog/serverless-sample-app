//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package productacl

import (
	sharedprops "cdk/shared"
	sharedconstructs "cdk/sharedConstructs"
	"fmt"

	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awseventstargets"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambdaeventsources"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductAclServiceProps struct {
	SharedProps    sharedprops.SharedProps
	SharedEventBus awsevents.IEventBus
}

func NewProductAclService(scope constructs.Construct, id string, props *ProductAclServiceProps) {
	productStockUpdatedTopic := awssns.NewTopic(scope, jsii.String("GoProductProductAddedTopic"), &awssns.TopicProps{
		TopicName: jsii.Sprintf("GoProductInventoryStockUpdated-%s", props.SharedProps.Env),
	})

	productStockUpdatedEventQueue := sharedconstructs.NewResiliantQueue(scope, "GoProductStockUpdatedEventQueue", &sharedconstructs.ResiliantQueueProps{
		SharedProps: props.SharedProps,
		QueueName:   "GoProductStockUpdatedEventQueue",
	})

	environmentVariables := make(map[string]*string)
	environmentVariables["STOCK_LEVEL_UPDATED_TOPIC_ARN"] = jsii.String(*productStockUpdatedTopic.TopicArn())

	publicEventPublisherFunction := sharedconstructs.NewInstrumentedFunction(scope, "ProductAcl", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		FunctionName:         "GoProductAcl",
		Entry:                "../src/product-acl/inventory-stock-updated-event-handler/",
		EnvironmentVariables: environmentVariables,
	})

	productStockUpdatedTopic.GrantPublish(publicEventPublisherFunction.Function)

	publicEventPublisherFunction.Function.AddEventSource(awslambdaeventsources.NewSqsEventSource(productStockUpdatedEventQueue.Queue, &awslambdaeventsources.SqsEventSourceProps{
		ReportBatchItemFailures: jsii.Bool(true),
	}))

	productCreatedRule := awsevents.NewRule(scope, jsii.String("Product-StockUpdated"), &awsevents.RuleProps{
		EventBus: props.SharedEventBus,
	})

	productCreatedRule.AddEventPattern(&awsevents.EventPattern{
		DetailType: jsii.Strings("inventory.stockUpdated.v1"),
		Source:     jsii.Strings(fmt.Sprintf("%s.inventory", props.SharedProps.Env)),
	})
	productCreatedRule.AddTarget(awseventstargets.NewSqsQueue(productStockUpdatedEventQueue.Queue, &awseventstargets.SqsQueueProps{}))

	awsssm.NewStringParameter(scope, jsii.String("GoProductProductAddedTopicParam"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/inventory-stock-updated-topic"),
		StringValue:   productStockUpdatedTopic.TopicArn(),
	})

	awsssm.NewStringParameter(scope, jsii.String("GoProductProductAddedTopicNameParam"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/inventory-stock-updated-topic-name"),
		StringValue:   productStockUpdatedTopic.TopicName(),
	})
}
