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
	"strconv"
	"strings"

	adapters "productacl/internal/adapters"
	core "productacl/internal/core"

	observability "github.com/datadog/serverless-sample-observability"

	"github.com/aws/aws-sdk-go-v2/aws"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"

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
	snsClient       = sns.NewFromConfig(awsCfg)
	eventTranslator = *core.NewProductEventTranslator(adapters.NewSnsEventPublisher(*snsClient))
)

func Handle(ctx context.Context, request events.SQSEvent) (events.SQSEventResponse, error) {
	failures := []events.SQSBatchItemFailure{}

	for index := range request.Records {
		record := request.Records[index]

		sqsBody := []byte(record.Body)

		var eventBridgeEvent events.EventBridgeEvent
		json.Unmarshal(sqsBody, &eventBridgeEvent)

		fmt.Printf("EventBridge body is %s", eventBridgeEvent.Detail)

		body := []byte(eventBridgeEvent.Detail)

		var evt observability.CloudEvent[core.PublicPricingUpdatedEventV1]
		json.Unmarshal(body, &evt)

		// Parse traceparent if available
		var spanLinks []ddtrace.SpanLink
		if evt.TraceParent != "" {
			fmt.Printf("Traceparent found %s", evt.TraceParent)
			// W3C traceparent format: 00-<trace-id>-<parent-id>-<trace-flags>
			var traceID, spanID uint64
			parts := strings.Split(evt.TraceParent, "-")
			if len(parts) >= 3 {
				fmt.Print("Traceparent is valid, and has 3+ parts")

				if len(parts[1]) == 32 {
					traceID, _ = strconv.ParseUint(parts[1][16:], 16, 64)
					fmt.Printf("Trace ID is %d", traceID)
				}
				// Parse span ID (64-bit)
				if len(parts[2]) == 16 {
					spanID, _ = strconv.ParseUint(parts[2], 16, 64)
					fmt.Printf("Span ID is %d", traceID)
				}

				// Create span link if parsing succeeded
				if traceID != 0 && spanID != 0 {
					fmt.Printf("Creating span link with trace ID %d and span ID %d", traceID, spanID)
					spanLinks = append(spanLinks, ddtrace.SpanLink{
						TraceID: traceID,
						SpanID:  spanID,
					})
				}
			}
		}

		spanOptions := tracer.WithSpanLinks(spanLinks)
		span := tracer.StartSpan("process pricing.pricingChanged.v1", spanOptions)
		defer span.Finish()

		_, err := eventTranslator.HandleProductPricingChanged(ctx, evt.Data)

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
	lambda.Start(ddlambda.WrapFunction(Handle, nil))
}
