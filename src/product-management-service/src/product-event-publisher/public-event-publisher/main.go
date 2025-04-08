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
	"os"
	"product-event-publisher/internal/adapters"
	"product-event-publisher/internal/core"

	observability "github.com/datadog/serverless-sample-observability"

	"github.com/aws/aws-sdk-go-v2/aws"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	eventBridgeClient = eventbridge.NewFromConfig(awsCfg)
	handler           = core.NewProductEventTranslator(
		adapters.NewEventBridgeEventPublisher(*eventBridgeClient))
)

func functionHandler(ctx context.Context, request events.SQSEvent) (events.SQSEventResponse, error) {
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
			_, err := processCreatedEvent(ctx, snsMessage)

			if err != nil {
				println(err.Error())
				failures = append(failures, events.SQSBatchItemFailure{
					ItemIdentifier: record.MessageId,
				})
			}

		case os.Getenv("PRODUCT_UPDATED_TOPIC_ARN"):
			_, err := processUpdatedEvent(ctx, snsMessage)

			if err != nil {
				println(err.Error())
				failures = append(failures, events.SQSBatchItemFailure{
					ItemIdentifier: record.MessageId,
				})
			}

		case os.Getenv("PRODUCT_DELETED_TOPIC_ARN"):
			_, err := processDeletedEvent(ctx, snsMessage)

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

func processCreatedEvent(ctx context.Context, snsMessage events.SNSEntity) (string, error) {
	body := []byte(snsMessage.Message)

	var evt observability.CloudEvent[core.ProductCreatedEvent]
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

	span := tracer.StartSpan("process product.productCreated", tracer.WithSpanLinks(spanLinks))
	defer span.Finish()

	return handler.HandleCreated(ctx, evt.Data)
}

func processUpdatedEvent(ctx context.Context, snsMessage events.SNSEntity) (string, error) {
	body := []byte(snsMessage.Message)

	var evt observability.CloudEvent[core.ProductUpdatedEvent]
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

	span := tracer.StartSpan("process product.productUpdated", tracer.WithSpanLinks(spanLinks))
	defer span.Finish()

	return handler.HandleUpdated(ctx, core.ProductUpdatedEvent(evt.Data))
}

func processDeletedEvent(ctx context.Context, snsMessage events.SNSEntity) (string, error) {
	body := []byte(snsMessage.Message)

	var evt observability.CloudEvent[core.ProductDeletedEvent]
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

	span := tracer.StartSpan("process product.productDeleted", tracer.WithSpanLinks(spanLinks))
	defer span.Finish()

	return handler.HandleDeleted(ctx, evt.Data)
}

func main() {
	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
