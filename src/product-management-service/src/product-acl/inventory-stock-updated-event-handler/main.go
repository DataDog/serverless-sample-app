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
	adapters "productacl/internal/adapters"
	core "productacl/internal/core"
	"strconv"
	"strings"

	"gopkg.in/DataDog/dd-trace-go.v1/datastreams"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams/options"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"

	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"

	"github.com/aws/aws-sdk-go-v2/aws"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	observability "github.com/datadog/serverless-sample-observability"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
)

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	snsClient       = sns.NewFromConfig(awsCfg)
	eventTranslator = *core.NewProductEventTranslator(adapters.NewSnsEventPublisher(*snsClient))
)

func Handle(ctx context.Context, request events.SQSEvent) (events.SQSEventResponse, error) {
	span, _ := tracer.SpanFromContext(ctx)
	span.SetTag("messaging.batch.size", len(request.Records))

	var failures []events.SQSBatchItemFailure

	for index := range request.Records {
		record := request.Records[index]

		err := processMessage(ctx, record, span)

		if err != nil {
			fmt.Printf("Error processing message %s: %v\n", record.MessageId, err)
			span.SetTag("error", "true")
			span.SetTag("error.message", err.Error())
			failures = append(failures, events.SQSBatchItemFailure{
				ItemIdentifier: record.MessageId,
			})
		}
	}

	return events.SQSEventResponse{
		BatchItemFailures: failures,
	}, nil
}

func processMessage(ctx context.Context, record events.SQSMessage) error {
	sqsBody := []byte(record.Body)

	var eventBridgeEvent events.EventBridgeEvent
	jsonErr := json.Unmarshal(sqsBody, &eventBridgeEvent)

	if jsonErr != nil {
		return jsonErr
	}

	body := []byte(eventBridgeEvent.Detail)

	var evt observability.CloudEvent[core.PublicInventoryStockUpdatedEventV1]
	jsonErr = json.Unmarshal(body, &evt)

	if jsonErr != nil {
		return jsonErr
	}

	var spanLinks []ddtrace.SpanLink

	if evt.TraceParent != "" {
		// Split the traceparent header to extract trace ID and span ID. The traceparent should be a valid W3C trace context.
		parts := strings.Split(evt.TraceParent, "-")

		if len(parts) == 4 {
			traceId, err := strconv.ParseUint(parts[1], 16, 64)
			if err == nil {
				spanId, err := strconv.ParseUint(parts[2], 16, 64)
				if err == nil {
					spanLinks = append(spanLinks, ddtrace.SpanLink{
						TraceID: traceId,
						SpanID:  spanId,
					})
				}
			}
		}
	}

	_, _ = tracer.SetDataStreamsCheckpointWithParams(datastreams.ExtractFromBase64Carrier(context.Background(), evt), options.CheckpointParams{
		ServiceOverride: "productservice-acl",
	}, "direction:in", "type:sns", "topic:"+evt.Type, "manual_checkpoint:true")
	processSpan, _ := tracer.StartSpanFromContext(ctx, fmt.Sprintf("process %s", evt.Type), tracer.WithSpanLinks(spanLinks))
	defer processSpan.Finish()

	processSpan.SetTag("product.id", evt.Data.ProductId)
	processSpan.SetTag("messaging.message.id", evt.Id)
	processSpan.SetTag("messaging.message.type", evt.Type)
	processSpan.SetTag("messaging.message.envelope.size", len(record.Body))
	processSpan.SetTag("messaging.operation.name", "process")
	processSpan.SetTag("messaging.operation.type", "process")
	processSpan.SetTag("messaging.system", "aws_sqs")

	_, err := eventTranslator.HandleStockUpdated(ctx, evt.Data)

	return err
}

func main() {
	lambda.Start(ddlambda.WrapFunction(Handle, nil))
}
