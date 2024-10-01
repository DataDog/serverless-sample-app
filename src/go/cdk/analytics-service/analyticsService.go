package analyticsservice

import (
	sharedprops "cdk/shared"
	sharedconstructs "cdk/sharedConstructs"

	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awseventstargets"
	"github.com/aws/aws-cdk-go/awscdk/v2/awslambdaeventsources"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type AnalyticsServiceProps struct {
	SharedProps    sharedprops.SharedProps
	SharedEventBus awsevents.IEventBus
}

func NewAnalyticsService(scope constructs.Construct, id string, props *AnalyticsServiceProps) {
	analyticsCatchAllEventsQueue := sharedconstructs.NewResiliantQueue(scope, "GoAnalyticsQueue", &sharedconstructs.ResiliantQueueProps{
		SharedProps: props.SharedProps,
		QueueName:   "GoAnalyticsQueue",
	})

	environmentVariables := make(map[string]*string)

	eventAnalyticsHandler := sharedconstructs.NewInstrumentedFunction(scope, "EventAnalytics", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		FunctionName:         "GoEventAnalytics",
		Entry:                "../src/analytics-service/handle-events/",
		EnvironmentVariables: environmentVariables,
	})

	eventAnalyticsHandler.Function.AddEventSource(awslambdaeventsources.NewSqsEventSource(analyticsCatchAllEventsQueue.Queue, &awslambdaeventsources.SqsEventSourceProps{
		ReportBatchItemFailures: jsii.Bool(true),
	}))

	productCreatedRule := awsevents.NewRule(scope, jsii.String("Analytics-CatchAll"), &awsevents.RuleProps{
		EventBus: props.SharedEventBus,
	})

	productCreatedRule.AddEventPattern(&awsevents.EventPattern{
		Source: awsevents.Match_Prefix(&props.SharedProps.Env),
	})
	productCreatedRule.AddTarget(awseventstargets.NewSqsQueue(analyticsCatchAllEventsQueue.Queue, &awseventstargets.SqsQueueProps{}))
}
