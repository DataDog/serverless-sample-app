package producteventpublisher

import (
	sharedprops "cdk/shared"
	sharedconstructs "cdk/sharedConstructs"

	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambdaeventsources"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssnssubscriptions"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductPublicEventPublisherServiceProps struct {
	SharedProps         sharedprops.SharedProps
	ProductCreatedTopic awssns.ITopic
	ProductUpdatedTopic awssns.ITopic
	ProductDeletedTopic awssns.ITopic
	SharedEventBus      awsevents.IEventBus
}

func NewProductPublicEventPublisherService(scope constructs.Construct, id string, props *ProductPublicEventPublisherServiceProps) {
	publicEventPublisherQueue := sharedconstructs.NewResiliantQueue(scope, "ProductPublicEventPublisherQueue", &sharedconstructs.ResiliantQueueProps{
		SharedProps: props.SharedProps,
		QueueName:   "GoProductPublicEventPublisher",
	})

	environmentVariables := make(map[string]*string)
	environmentVariables["PRODUCT_CREATED_TOPIC_ARN"] = jsii.String(*props.ProductCreatedTopic.TopicArn())
	environmentVariables["PRODUCT_UPDATED_TOPIC_ARN"] = jsii.String(*props.ProductUpdatedTopic.TopicArn())
	environmentVariables["PRODUCT_DELETED_TOPIC_ARN"] = jsii.String(*props.ProductDeletedTopic.TopicArn())
	environmentVariables["EVENT_BUS_NAME"] = jsii.String(*props.SharedEventBus.EventBusName())

	publicEventPublisherFunction := sharedconstructs.NewInstrumentedFunction(scope, "PublicEventPublisher", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		FunctionName:         "GoProductEventPublisher",
		Entry:                "../src/product-event-publisher/public-event-publisher/",
		EnvironmentVariables: environmentVariables,
	})

	props.SharedEventBus.GrantPutEventsTo(publicEventPublisherFunction.Function)

	publicEventPublisherFunction.Function.AddEventSource(awslambdaeventsources.NewSqsEventSource(publicEventPublisherQueue.Queue, &awslambdaeventsources.SqsEventSourceProps{
		ReportBatchItemFailures: jsii.Bool(true),
	}))

	props.ProductCreatedTopic.AddSubscription(awssnssubscriptions.NewSqsSubscription(publicEventPublisherQueue.Queue, &awssnssubscriptions.SqsSubscriptionProps{}))
	props.ProductUpdatedTopic.AddSubscription(awssnssubscriptions.NewSqsSubscription(publicEventPublisherQueue.Queue, &awssnssubscriptions.SqsSubscriptionProps{}))
	props.ProductDeletedTopic.AddSubscription(awssnssubscriptions.NewSqsSubscription(publicEventPublisherQueue.Queue, &awssnssubscriptions.SqsSubscriptionProps{}))
}
