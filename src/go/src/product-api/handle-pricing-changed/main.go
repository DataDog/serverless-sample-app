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
	"os"

	"product-api/internal/adapters"
	"product-api/internal/core"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

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
	commandHandler core.PricingUpdatedEventHandler
}

func NewLambdaHandler(commandHandler core.PricingUpdatedEventHandler) *LambdaHandler {
	return &LambdaHandler{commandHandler: commandHandler}
}

func (lh *LambdaHandler) Handle(ctx context.Context, request events.SNSEvent) {
	for index := range request.Records {
		record := request.Records[index]

		body := []byte(record.SNS.Message)

		var evt TracedMessage[core.PriceCalculatedEvent]
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

		_, err = lh.commandHandler.Handle(context, evt.Data)

		if err != nil {
			println(err.Error())
			panic(err.Error())
		}
	}
}

func main() {
	awsCfg, _ := awscfg.LoadDefaultConfig(context.Background())
	awstrace.AppendMiddleware(&awsCfg)
	dynamoDbClient := dynamodb.NewFromConfig(awsCfg)

	tableName := os.Getenv("TABLE_NAME")

	handler := NewLambdaHandler(*core.NewPricingUpdatedEventHandler(adapters.NewDynamoDbProductRepository(*dynamoDbClient, tableName)))

	lambda.Start(ddlambda.WrapFunction(handler.Handle, nil))
}
