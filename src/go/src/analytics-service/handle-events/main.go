package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/DataDog/datadog-go/v5/statsd"
	ddlambda "github.com/DataDog/datadog-lambda-go"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type TracedMessage[T any] struct {
	Data    T                     `json:"data"`
	Datadog tracer.TextMapCarrier `json:"_datadog"`
}

type LambdaHandler struct {
	statsd statsd.Client
}

func NewLambdaHandler(statsd statsd.Client) *LambdaHandler {
	return &LambdaHandler{statsd: statsd}
}

func (lh *LambdaHandler) Handle(ctx context.Context, request events.SQSEvent) (events.SQSEventResponse, error) {
	failures := []events.SQSBatchItemFailure{}

	for index := range request.Records {
		record := request.Records[index]

		sqsBody := []byte(record.Body)

		var eventBridgeEvent events.EventBridgeEvent
		json.Unmarshal(sqsBody, &eventBridgeEvent)

		fmt.Printf("EventBridge body is %s", eventBridgeEvent.Detail)
		lh.statsd.Incr(eventBridgeEvent.DetailType, []string{}, 1)
	}

	return events.SQSEventResponse{
		BatchItemFailures: failures,
	}, nil
}

func main() {
	statsd, _ := statsd.New("127.0.0.1:8125")

	handler := NewLambdaHandler(*statsd)

	lambda.Start(ddlambda.WrapFunction(handler.Handle, nil))
}
