package sharedconstructs

import (
	sharedprops "cdk/shared"

	"github.com/aws/aws-cdk-go/awscdk/v2/awssqs"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ResiliantQueueProps struct {
	QueueName   string
	SharedProps sharedprops.SharedProps
}

type ResiliantQueue struct {
	Queue awssqs.IQueue
	DLQ   awssqs.IQueue
}

func NewResiliantQueue(scope constructs.Construct, id string, props *ResiliantQueueProps) ResiliantQueue {
	resiliantQueue := ResiliantQueue{}

	resiliantQueue.DLQ = awssqs.NewQueue(scope, jsii.Sprintf("%sDLQ-%s", props.QueueName, props.SharedProps.Env), &awssqs.QueueProps{
		QueueName: jsii.Sprintf("%sDLQ-%s", props.QueueName, props.SharedProps.Env),
	})

	resiliantQueue.Queue = awssqs.NewQueue(scope, jsii.Sprintf("%s-%s", props.QueueName, props.SharedProps.Env), &awssqs.QueueProps{
		QueueName: jsii.Sprintf("%s-%s", props.QueueName, props.SharedProps.Env),
		DeadLetterQueue: &awssqs.DeadLetterQueue{
			MaxReceiveCount: jsii.Number(3),
			Queue:           resiliantQueue.DLQ,
		},
	})

	return resiliantQueue
}
