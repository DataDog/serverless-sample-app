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
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
	adapters "productacl/internal/adapters"
	core "productacl/internal/core"

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
	failures := []events.SQSBatchItemFailure{}

	for index := range request.Records {
		record := request.Records[index]

		sqsBody := []byte(record.Body)

		var eventBridgeEvent events.EventBridgeEvent
		json.Unmarshal(sqsBody, &eventBridgeEvent)

		fmt.Println("EventBridge body is %s", eventBridgeEvent.Detail)

		body := []byte(eventBridgeEvent.Detail)

		var evt observability.CloudEvent[core.PublicInventoryStockUpdatedEventV1]
		json.Unmarshal(body, &evt)

		span, _ := tracer.StartSpanFromContext(ctx, "process inventory.stockUpdated.v1")

		_, err := eventTranslator.HandleStockUpdated(ctx, evt.Data)

		if err != nil {
			println(err.Error())
			failures = append(failures, events.SQSBatchItemFailure{
				ItemIdentifier: record.MessageId,
			})
		}
		span.Finish()
	}

	return events.SQSEventResponse{
		BatchItemFailures: failures,
	}, nil
}

func main() {
	lambda.Start(ddlambda.WrapFunction(Handle, nil))
}
