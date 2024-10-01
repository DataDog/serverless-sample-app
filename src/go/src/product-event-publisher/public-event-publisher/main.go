package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"product-event-publisher/internal/adapters"
	"product-event-publisher/internal/core"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type TracedMessage[T any] struct {
	Data    T                     `json:"data"`
	Datadog tracer.TextMapCarrier `json:"_datadog"`
}

type LambdaHandler struct {
	commandHandler core.ProductEventTranslator
}

func NewLambdaHandler(commandHandler core.ProductEventTranslator) *LambdaHandler {
	return &LambdaHandler{commandHandler: commandHandler}
}

func (lh *LambdaHandler) Handle(ctx context.Context, request events.SQSEvent) (events.SQSEventResponse, error) {

	failures := []events.SQSBatchItemFailure{}

	for index := range request.Records {
		record := request.Records[index]

		body := []byte(record.Body)

		var snsMessage events.SNSEntity
		json.Unmarshal(body, &snsMessage)

		fmt.Printf("SNS Message body is %s", snsMessage.Message)
		fmt.Printf("Topic is %s", snsMessage.TopicArn)

		switch snsMessage.TopicArn {
		case os.Getenv("PRODUCT_CREATED_TOPIC_ARN"):
			_, err := lh.processCreatedEvent(ctx, snsMessage)

			if err != nil {
				println(err.Error())
				failures = append(failures, events.SQSBatchItemFailure{
					ItemIdentifier: record.MessageId,
				})
			}

		case os.Getenv("PRODUCT_UPDATED_TOPIC_ARN"):
			_, err := lh.processUpdatedEvent(ctx, snsMessage)

			if err != nil {
				println(err.Error())
				failures = append(failures, events.SQSBatchItemFailure{
					ItemIdentifier: record.MessageId,
				})
			}

		case os.Getenv("PRODUCT_DELETED_TOPIC_ARN"):
			_, err := lh.processDeletedEvent(ctx, snsMessage)

			if err != nil {
				println(err.Error())
				failures = append(failures, events.SQSBatchItemFailure{
					ItemIdentifier: record.MessageId,
				})
			}
		}

	}

	return events.SQSEventResponse{
		BatchItemFailures: failures,
	}, nil
}

func (lh *LambdaHandler) processCreatedEvent(ctx context.Context, snsMessage events.SNSEntity) (string, error) {
	body := []byte(snsMessage.Message)

	var evt TracedMessage[core.ProductCreatedEvent]
	json.Unmarshal(body, &evt)

	sctx, err := tracer.Extract(evt.Datadog)

	if err != nil {
		println(err.Error())
	}

	spanLinks := []ddtrace.SpanLink{
		{
			TraceID: sctx.TraceID(),
			SpanID:  sctx.SpanID(),
		},
	}

	span, context := tracer.StartSpanFromContext(ctx, "process.message", tracer.WithSpanLinks(spanLinks))
	defer span.Finish()

	return lh.commandHandler.HandleCreated(context, evt.Data)
}

func (lh *LambdaHandler) processUpdatedEvent(ctx context.Context, snsMessage events.SNSEntity) (string, error) {
	body := []byte(snsMessage.Message)

	var evt TracedMessage[core.ProductUpdatedEvent]
	json.Unmarshal(body, &evt)

	sctx, err := tracer.Extract(evt.Datadog)

	if err != nil {
		println(err.Error())
	}

	spanLinks := []ddtrace.SpanLink{
		{
			TraceID: sctx.TraceID(),
			SpanID:  sctx.SpanID(),
		},
	}

	span, context := tracer.StartSpanFromContext(ctx, "process.message", tracer.WithSpanLinks(spanLinks))
	defer span.Finish()

	return lh.commandHandler.HandleUpdated(context, core.ProductUpdatedEvent(evt.Data))
}

func (lh *LambdaHandler) processDeletedEvent(ctx context.Context, snsMessage events.SNSEntity) (string, error) {
	body := []byte(snsMessage.Message)

	var evt TracedMessage[core.ProductDeletedEvent]
	json.Unmarshal(body, &evt)

	sctx, err := tracer.Extract(evt.Datadog)

	if err != nil {
		println(err.Error())
	}

	spanLinks := []ddtrace.SpanLink{
		{
			TraceID: sctx.TraceID(),
			SpanID:  sctx.SpanID(),
		},
	}

	span, context := tracer.StartSpanFromContext(ctx, "process.message", tracer.WithSpanLinks(spanLinks))
	defer span.Finish()

	return lh.commandHandler.HandleDeleted(context, evt.Data)
}

func main() {
	awsCfg, _ := awscfg.LoadDefaultConfig(context.Background())
	awstrace.AppendMiddleware(&awsCfg)
	eventBridgeClient := eventbridge.NewFromConfig(awsCfg)

	handler := NewLambdaHandler(*core.NewProductEventTranslator(adapters.NewEventBridgeEventPublisher(*eventBridgeClient)))

	lambda.Start(ddlambda.WrapFunction(handler.Handle, nil))
}
