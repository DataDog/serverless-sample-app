package inventoryacl

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

type InventoryAclServiceProps struct {
	SharedProps    sharedprops.SharedProps
	SharedEventBus awsevents.IEventBus
}

func NewInventoryAclService(scope constructs.Construct, id string, props *InventoryAclServiceProps) {
	inventoryProductAddedTopic := awssns.NewTopic(scope, jsii.String("GoInventoryProductAddedTopic"), &awssns.TopicProps{
		TopicName: jsii.Sprintf("GoInventoryProductAddedTopic-%s", props.SharedProps.Env),
	})

	productCreatedPublicEventQueue := sharedconstructs.NewResiliantQueue(scope, "GoProductCreatedPublicEventQueue", &sharedconstructs.ResiliantQueueProps{
		SharedProps: props.SharedProps,
		QueueName:   "GoProductCreatedPublicEventQueue",
	})

	environmentVariables := make(map[string]*string)
	environmentVariables["PRODUCT_ADDED_TOPIC_ARN"] = jsii.String(*inventoryProductAddedTopic.TopicArn())

	publicEventPublisherFunction := sharedconstructs.NewInstrumentedFunction(scope, "InventoryAcl", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		FunctionName:         "GoInventoryAcl",
		Entry:                "../src/inventory-acl/product-created-public-event-handler/",
		EnvironmentVariables: environmentVariables,
	})

	inventoryProductAddedTopic.GrantPublish(publicEventPublisherFunction.Function)

	publicEventPublisherFunction.Function.AddEventSource(awslambdaeventsources.NewSqsEventSource(productCreatedPublicEventQueue.Queue, &awslambdaeventsources.SqsEventSourceProps{
		ReportBatchItemFailures: jsii.Bool(true),
	}))

	productCreatedRule := awsevents.NewRule(scope, jsii.String("Inventory-OrderCreated"), &awsevents.RuleProps{
		EventBus: props.SharedEventBus,
	})

	productCreatedRule.AddEventPattern(&awsevents.EventPattern{
		DetailType: jsii.Strings("product.productCreated.v1"),
		Source:     jsii.Strings(fmt.Sprintf("%s.products", props.SharedProps.Env)),
	})
	productCreatedRule.AddTarget(awseventstargets.NewSqsQueue(productCreatedPublicEventQueue.Queue, &awseventstargets.SqsQueueProps{}))

	awsssm.NewStringParameter(scope, jsii.String("GoInventoryProductAddedTopicParam"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/inventory/product-added-topic"),
		StringValue:   inventoryProductAddedTopic.TopicArn(),
	})

	awsssm.NewStringParameter(scope, jsii.String("GoInventoryProductAddedTopicNameParam"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/inventory/product-added-topic-name"),
		StringValue:   inventoryProductAddedTopic.TopicName(),
	})
}
