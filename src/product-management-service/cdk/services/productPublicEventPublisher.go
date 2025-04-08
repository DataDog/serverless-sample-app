//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package services

import (
	sharedconstructs "cdk/sharedConstructs"

	"github.com/aws/aws-cdk-go/awscdk/v2/awslambdaeventsources"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssnssubscriptions"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductPublicEventPublisherServiceProps struct {
	ServiceProps        ProductServiceProps
	ProductCreatedTopic awssns.ITopic
	ProductUpdatedTopic awssns.ITopic
	ProductDeletedTopic awssns.ITopic
}

func NewProductPublicEventPublisherService(scope constructs.Construct, id string, props *ProductPublicEventPublisherServiceProps) {
	publicEventPublisherQueue := sharedconstructs.NewResiliantQueue(scope, "ProductPublicEventPublisherQueue", &sharedconstructs.ResiliantQueueProps{
		SharedProps: props.ServiceProps.SharedProps,
		QueueName:   "ProductPublicEventPublisher",
	})

	environmentVariables := make(map[string]*string)
	environmentVariables["PRODUCT_CREATED_TOPIC_ARN"] = jsii.String(*props.ProductCreatedTopic.TopicArn())
	environmentVariables["PRODUCT_UPDATED_TOPIC_ARN"] = jsii.String(*props.ProductUpdatedTopic.TopicArn())
	environmentVariables["PRODUCT_DELETED_TOPIC_ARN"] = jsii.String(*props.ProductDeletedTopic.TopicArn())
	environmentVariables["EVENT_BUS_NAME"] = jsii.String(*props.ServiceProps.getPublisherEventBus().EventBusName())

	publicEventPublisherFunction := sharedconstructs.NewInstrumentedFunction(scope, "PublicEventPublisher", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		FunctionName:         "ProductEventPublisher",
		Entry:                "../src/product-event-publisher/public-event-publisher/",
		EnvironmentVariables: environmentVariables,
	})

	props.ServiceProps.getPublisherEventBus().GrantPutEventsTo(publicEventPublisherFunction.Function, jsii.String("product-event-publisher"))

	publicEventPublisherFunction.Function.AddEventSource(awslambdaeventsources.NewSqsEventSource(publicEventPublisherQueue.Queue, &awslambdaeventsources.SqsEventSourceProps{
		ReportBatchItemFailures: jsii.Bool(true),
	}))

	props.ProductCreatedTopic.AddSubscription(awssnssubscriptions.NewSqsSubscription(publicEventPublisherQueue.Queue, &awssnssubscriptions.SqsSubscriptionProps{}))
	props.ProductUpdatedTopic.AddSubscription(awssnssubscriptions.NewSqsSubscription(publicEventPublisherQueue.Queue, &awssnssubscriptions.SqsSubscriptionProps{}))
	props.ProductDeletedTopic.AddSubscription(awssnssubscriptions.NewSqsSubscription(publicEventPublisherQueue.Queue, &awssnssubscriptions.SqsSubscriptionProps{}))
}
