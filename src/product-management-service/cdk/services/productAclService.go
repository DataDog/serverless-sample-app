//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package services

import (
	sharedconstructs "cdk/sharedConstructs"
	"fmt"

	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awseventstargets"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambdaeventsources"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductAclServiceProps struct {
	ServiceProps ProductServiceProps
}

type ProductAcl struct {
	ProductStockUpdatedTopic awssns.Topic
}

func NewProductAclService(scope constructs.Construct, id string, props *ProductAclServiceProps) ProductAcl {
	productStockUpdatedTopic := awssns.NewTopic(scope, jsii.String("ProductProductAddedTopic"), &awssns.TopicProps{
		TopicName: jsii.Sprintf("%s-InventoryStockUpdated-%s", props.ServiceProps.SharedProps.ServiceName, props.ServiceProps.SharedProps.Env),
	})

	productStockUpdatedEventQueue := sharedconstructs.NewResiliantQueue(scope, "ProductStockUpdatedEventQueue", &sharedconstructs.ResiliantQueueProps{
		SharedProps: props.ServiceProps.SharedProps,
		QueueName:   "ProductStockUpdatedEventQueue",
	})

	environmentVariables := make(map[string]*string)
	environmentVariables["STOCK_LEVEL_UPDATED_TOPIC_ARN"] = jsii.String(*productStockUpdatedTopic.TopicArn())

	publicEventPublisherFunction := sharedconstructs.NewInstrumentedFunction(scope, "ProductAcl", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		FunctionName:         "ProductAcl",
		Entry:                "../src/product-acl/inventory-stock-updated-event-handler/",
		EnvironmentVariables: environmentVariables,
	})

	productStockUpdatedTopic.GrantPublish(publicEventPublisherFunction.Function)

	publicEventPublisherFunction.Function.AddEventSource(awslambdaeventsources.NewSqsEventSource(productStockUpdatedEventQueue.Queue, &awslambdaeventsources.SqsEventSourceProps{
		ReportBatchItemFailures: jsii.Bool(true),
	}))

	productCreatedRule := awsevents.NewRule(scope, jsii.String("Product-StockUpdated"), &awsevents.RuleProps{
		EventBus: props.ServiceProps.SubscriberEventBus,
	})

	productCreatedRule.AddEventPattern(&awsevents.EventPattern{
		DetailType: jsii.Strings("inventory.stockUpdated.v1"),
		Source:     jsii.Strings(fmt.Sprintf("%s.inventory", props.ServiceProps.SharedProps.Env)),
	})
	productCreatedRule.AddTarget(awseventstargets.NewSqsQueue(productStockUpdatedEventQueue.Queue, &awseventstargets.SqsQueueProps{}))

	return ProductAcl{
		ProductStockUpdatedTopic: productStockUpdatedTopic,
	}
}
