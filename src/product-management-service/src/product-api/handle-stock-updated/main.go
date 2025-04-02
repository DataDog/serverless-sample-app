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
	"github.com/aws/aws-sdk-go-v2/aws"
	"os"

	core "github.com/datadog/serverless-sample-product-core"
	"product-api/internal/adapters"

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

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	handler = core.NewProductStockUpdatedEventHandler(
		adapters.NewDynamoDbProductRepository(*dynamodb.NewFromConfig(awsCfg), os.Getenv("TABLE_NAME")))
)

func functionHandler(ctx context.Context, request events.SNSEvent) {
	span, _ := tracer.SpanFromContext(ctx)
	defer span.Finish()

	for index := range request.Records {
		record := request.Records[index]

		fmt.Printf("SNS message body is %s", record.SNS.Message)

		body := []byte(record.SNS.Message)

		var evt TracedMessage[core.StockUpdatedEvent]
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

		span, traceContext := tracer.StartSpanFromContext(ctx, "process stockUpdated", tracer.WithSpanLinks(spanLinks))

		_, err = handler.Handle(traceContext, evt.Data)

		span.Finish()

		if err != nil {
			println(err.Error())
			panic(err.Error())
		}
	}
}

func main() {
	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
