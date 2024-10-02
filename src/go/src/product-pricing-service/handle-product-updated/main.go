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
	"product-pricing-service/internal/adapters"
	"product-pricing-service/internal/core"
	"product-pricing-service/internal/utils"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type LambdaHandler struct {
	commandHandler core.ProductUpdatedEventHandler
}

func NewLambdaHandler(commandHandler core.ProductUpdatedEventHandler) *LambdaHandler {
	return &LambdaHandler{commandHandler: commandHandler}
}

func (lh *LambdaHandler) Handle(ctx context.Context, request events.SNSEvent) error {

	for index := range request.Records {
		record := request.Records[index]

		body := []byte(record.SNS.Message)

		var evt utils.TracedMessage[core.ProductUpdatedEvent]
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

		return err
	}

	return nil
}

func main() {
	awsCfg, _ := awscfg.LoadDefaultConfig(context.Background())
	awstrace.AppendMiddleware(&awsCfg)
	snsClient := sns.NewFromConfig(awsCfg)

	handler := NewLambdaHandler(*core.NewProductUpdatedEventHandler(adapters.NewSnsEventPublisher(*snsClient), core.PricingService{}))

	lambda.Start(ddlambda.WrapFunction(handler.Handle, nil))
}
