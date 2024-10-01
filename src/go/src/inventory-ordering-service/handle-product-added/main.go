package main

import (
	"context"
	"encoding/json"
	"inventory-ordering-service/internal/adapters"
	"inventory-ordering-service/internal/core"
	"inventory-ordering-service/internal/utils"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sfn"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type LambdaHandler struct {
	commandHandler core.OrderingWorkflowEngine
}

func NewLambdaHandler(commandHandler core.OrderingWorkflowEngine) *LambdaHandler {
	return &LambdaHandler{commandHandler: commandHandler}
}

func (lh *LambdaHandler) Handle(ctx context.Context, request events.SNSEvent) {
	for index := range request.Records {
		record := request.Records[index]

		body := []byte(record.SNS.Message)

		var evt utils.TracedMessage[core.ProductAddedEvent]
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

		lh.commandHandler.StartOrderingWorkflowFor(context, evt.Data.ProductId)
	}
}

func main() {
	awsCfg, _ := awscfg.LoadDefaultConfig(context.Background())
	awstrace.AppendMiddleware(&awsCfg)
	sfnClient := sfn.NewFromConfig(awsCfg)

	handler := NewLambdaHandler(*adapters.NewStepFunctionsWorkflowEngine(*sfnClient))

	lambda.Start(ddlambda.WrapFunction(handler.Handle, nil))
}
