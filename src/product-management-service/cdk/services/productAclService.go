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
	PriceCalculatedTopic     awssns.Topic
}

func NewProductAclService(scope constructs.Construct, id string, props *ProductAclServiceProps) ProductAcl {
	productStockUpdatedTopic := awssns.NewTopic(scope, jsii.String("ProductProductAddedTopic"), &awssns.TopicProps{
		TopicName: jsii.Sprintf("%s-InventoryStockUpdated-%s", props.ServiceProps.SharedProps.ServiceName, props.ServiceProps.SharedProps.Env),
	})
	productPriceCalculatedTopic := awssns.NewTopic(scope, jsii.String("ProductPriceCalculatedTopic"), &awssns.TopicProps{
		TopicName: jsii.Sprintf("%s-PriceCalculated-%s", props.ServiceProps.SharedProps.ServiceName, props.ServiceProps.SharedProps.Env),
	})

	productStockUpdatedEventQueue := sharedconstructs.NewResiliantQueue(scope, "ProductStockUpdatedEventQueue", &sharedconstructs.ResiliantQueueProps{
		SharedProps: props.ServiceProps.SharedProps,
		QueueName:   "ProductStockUpdatedEventQueue",
	})

	productPriceCalculatedQueue := sharedconstructs.NewResiliantQueue(scope, "ProductPriceCalculatedQueue", &sharedconstructs.ResiliantQueueProps{
		SharedProps: props.ServiceProps.SharedProps,
		QueueName:   "ProductPriceCalculatedQueue",
	})

	environmentVariables := make(map[string]*string)
	environmentVariables["STOCK_LEVEL_UPDATED_TOPIC_ARN"] = jsii.String(*productStockUpdatedTopic.TopicArn())
	environmentVariables["PRICE_CALCULATED_TOPIC_ARN"] = jsii.String(*productPriceCalculatedTopic.TopicArn())

	inventoryStockUpdatedAclFunction := sharedconstructs.NewInstrumentedFunction(scope, "InventoryStockUpdatedACL", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		FunctionName:         "InventoryStockUpdatedACL",
		Entry:                "../src/product-acl/inventory-stock-updated-event-handler/",
		EnvironmentVariables: environmentVariables,
	})

	productStockUpdatedTopic.GrantPublish(inventoryStockUpdatedAclFunction.Function)

	inventoryStockUpdatedAclFunction.Function.AddEventSource(awslambdaeventsources.NewSqsEventSource(productStockUpdatedEventQueue.Queue, &awslambdaeventsources.SqsEventSourceProps{
		ReportBatchItemFailures: jsii.Bool(true),
	}))

	productCreatedRule := awsevents.NewRule(scope, jsii.String("Product-StockUpdated"), &awsevents.RuleProps{
		EventBus: props.ServiceProps.ProductEventBus,
	})

	stockUpdatedPattern := &awsevents.EventPattern{
		DetailType: jsii.Strings("inventory.stockUpdated.v1"),
		Source:     jsii.Strings(fmt.Sprintf("%s.inventory", props.ServiceProps.SharedProps.Env)),
	}

	productCreatedRule.AddEventPattern(stockUpdatedPattern)
	productCreatedRule.AddTarget(awseventstargets.NewSqsQueue(productStockUpdatedEventQueue.Queue, &awseventstargets.SqsQueueProps{}))

	productPricingChangedAclFunction := sharedconstructs.NewInstrumentedFunction(scope, "PricingChangedACLFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		FunctionName:         "PricingUpdatedACL",
		Entry:                "../src/product-acl/pricing-changed-handler/",
		EnvironmentVariables: environmentVariables,
	})

	productPriceCalculatedTopic.GrantPublish(productPricingChangedAclFunction.Function)

	productPricingChangedAclFunction.Function.AddEventSource(awslambdaeventsources.NewSqsEventSource(productPriceCalculatedQueue.Queue, &awslambdaeventsources.SqsEventSourceProps{
		ReportBatchItemFailures: jsii.Bool(true),
	}))

	priceCalculatedRule := awsevents.NewRule(scope, jsii.String("Product-PriceUpdated"), &awsevents.RuleProps{
		EventBus: props.ServiceProps.ProductEventBus,
	})

	priceCalculatedPattern := &awsevents.EventPattern{
		DetailType: jsii.Strings("pricing.pricingCalculated.v1"),
		Source:     jsii.Strings(fmt.Sprintf("%s.pricing", props.ServiceProps.SharedProps.Env)),
	}

	priceCalculatedRule.AddEventPattern(priceCalculatedPattern)
	priceCalculatedRule.AddTarget(awseventstargets.NewSqsQueue(productPriceCalculatedQueue.Queue, &awseventstargets.SqsQueueProps{}))

	// If the shared bus exists create the subscription on the shared bus as well
	if props.ServiceProps.SharedEventBus != nil {
		sharedProductCreatedRule := awsevents.NewRule(scope, jsii.String("SharedProduct-StockUpdated"), &awsevents.RuleProps{
			EventBus: props.ServiceProps.SharedEventBus,
		})
		sharedProductCreatedRule.AddEventPattern(stockUpdatedPattern)
		sharedProductCreatedRule.AddTarget(awseventstargets.NewEventBus(props.ServiceProps.ProductEventBus, &awseventstargets.EventBusProps{}))

		sharedPriceUpdatedRule := awsevents.NewRule(scope, jsii.String("SharedProduct-PricingUpdated"), &awsevents.RuleProps{
			EventBus: props.ServiceProps.SharedEventBus,
		})
		sharedPriceUpdatedRule.AddEventPattern(priceCalculatedPattern)
		sharedPriceUpdatedRule.AddTarget(awseventstargets.NewEventBus(props.ServiceProps.ProductEventBus, &awseventstargets.EventBusProps{}))
	}

	return ProductAcl{
		ProductStockUpdatedTopic: productStockUpdatedTopic,
		PriceCalculatedTopic:     productPriceCalculatedTopic,
	}
}
