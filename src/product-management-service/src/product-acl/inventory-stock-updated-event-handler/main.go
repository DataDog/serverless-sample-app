//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"product-acl/internal/adapters"
	"product-acl/internal/core"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"

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

		sqsBody := []byte(record.Body)

		var eventBridgeEvent events.EventBridgeEvent
		json.Unmarshal(sqsBody, &eventBridgeEvent)

		fmt.Printf("EventBridge body is %s", eventBridgeEvent.Detail)

		body := []byte(eventBridgeEvent.Detail)

		var evt TracedMessage[core.PublicInventoryStockUpdatedEventV1]
		json.Unmarshal(body, &evt)

		sctx, err := tracer.Extract(evt.Datadog)

		if err != nil {
			println(err.Error())
		}

		spanLinks := []ddtrace.SpanLink{}
		
		if sctx != nil {
			spanLinks = []ddtrace.SpanLink{
				{
					TraceID: sctx.TraceID(),
					SpanID:  sctx.SpanID(),
				},
			}
		}

		span, context := tracer.StartSpanFromContext(ctx, "process.message", tracer.WithSpanLinks(spanLinks))
		defer span.Finish()

		_, err = lh.commandHandler.HandleCreated(context, evt.Data)

		if err != nil {
			println(err.Error())
			failures = append(failures, events.SQSBatchItemFailure{
				ItemIdentifier: record.MessageId,
			})
		}
	}

	return events.SQSEventResponse{
		BatchItemFailures: failures,
	}, nil
}

func main() {
	awsCfg, _ := awscfg.LoadDefaultConfig(context.Background())
	awstrace.AppendMiddleware(&awsCfg)
	snsClient := sns.NewFromConfig(awsCfg)

	handler := NewLambdaHandler(*core.NewProductEventTranslator(adapters.NewSnsEventPublisher(*snsClient)))

	lambda.Start(ddlambda.WrapFunction(handler.Handle, nil))
}
