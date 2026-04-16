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

	"gopkg.in/DataDog/dd-trace-go.v1/datastreams"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams/options"

	productcore "github.com/datadog/serverless-sample-product-core"

	observability "github.com/datadog/serverless-sample-observability"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"

	"github.com/aws/aws-sdk-go-v2/aws"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
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
	span, _ := tracer.SpanFromContext(ctx)
	span.SetTag("messaging.batch.size", len(request.Records))

	var failures []events.SQSBatchItemFailure

	for index := range request.Records {
		record := request.Records[index]

		err := processMessage(ctx, record)

		if err != nil {
			span.SetTag("error.message", err.Error())
			span.SetTag("error", true)
			span.SetTag("error.type", fmt.Sprintf("%T", err))

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
	body := []byte(record.Body)

	var snsMessage events.SNSEntity
	jsonErr := json.Unmarshal(body, &snsMessage)

	if jsonErr != nil {
		println("Error unmarshalling SQS message:", jsonErr.Error())
		return jsonErr
	}

	switch snsMessage.TopicArn {
	case os.Getenv("PRODUCT_CREATED_TOPIC_ARN"):
		_, err := processCreatedEvent(ctx, snsMessage)

		if err != nil {
			return err
		}

	case os.Getenv("PRODUCT_UPDATED_TOPIC_ARN"):
		_, err := processUpdatedEvent(ctx, snsMessage)

		if err != nil {
			return err
		}

	case os.Getenv("PRODUCT_DELETED_TOPIC_ARN"):
		_, err := processDeletedEvent(ctx, snsMessage)

		if err != nil {
			return err
		}
	}

	return nil
}

func processCreatedEvent(ctx context.Context, snsMessage events.SNSEntity) (string, error) {
	body := []byte(snsMessage.Message)

	var evt observability.CloudEvent[core.ProductCreatedEvent]
	jsonErr := json.Unmarshal(body, &evt)

	if jsonErr != nil {
		return "", jsonErr
	}

	span, _ := tracer.StartSpanFromContext(ctx, fmt.Sprintf("process %s", evt.Type))
	defer span.Finish()

	// Extract DSM context using the incoming ctx so the checkpoint is linked to
	// the current trace, not an orphaned background context.
	ctx, _ = tracer.SetDataStreamsCheckpointWithParams(datastreams.ExtractFromBase64Carrier(ctx, &evt), options.CheckpointParams{
		ServiceOverride: "productservice-publiceventpublisher",
	}, "direction:in", productcore.InternalPubSubName, "topic:"+evt.Type, "manual_checkpoint:true")

	span.SetTag("product.id", evt.Data.ProductId)
	span.SetTag("messaging.message.id", evt.Id)
	span.SetTag("messaging.message.type", evt.Type)
	span.SetTag("messaging.message.envelope.size", len(snsMessage.Message))
	span.SetTag("messaging.operation.name", "process")
	span.SetTag("messaging.operation.type", "process")
	span.SetTag("messaging.system", "aws_sqs")

	result, err := handler.HandleCreated(ctx, evt.Data)
	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
	}
	return result, err
}

func processUpdatedEvent(ctx context.Context, snsMessage events.SNSEntity) (string, error) {
	body := []byte(snsMessage.Message)

	var evt observability.CloudEvent[core.ProductUpdatedEvent]
	jsonErr := json.Unmarshal(body, &evt)

	if jsonErr != nil {
		return "", jsonErr
	}

	span, _ := tracer.StartSpanFromContext(ctx, fmt.Sprintf("process %s", evt.Type))
	defer span.Finish()

	// Extract DSM context using the incoming ctx so the checkpoint is linked to
	// the current trace, not an orphaned background context.
	_, _ = tracer.SetDataStreamsCheckpointWithParams(datastreams.ExtractFromBase64Carrier(ctx, &evt), options.CheckpointParams{
		ServiceOverride: "productservice-publiceventpublisher",
	}, "direction:in", productcore.InternalPubSubName, "topic:"+evt.Type, "manual_checkpoint:true")

	span.SetTag("product.id", evt.Data.ProductId)
	span.SetTag("messaging.message.id", evt.Id)
	span.SetTag("messaging.message.type", evt.Type)
	span.SetTag("messaging.message.envelope.size", len(snsMessage.Message))
	span.SetTag("messaging.operation.name", "process")
	span.SetTag("messaging.operation.type", "process")
	span.SetTag("messaging.system", "aws_sqs")

	result, err := handler.HandleUpdated(ctx, evt.Data)
	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
	}
	return result, err
}

func processDeletedEvent(ctx context.Context, snsMessage events.SNSEntity) (string, error) {
	body := []byte(snsMessage.Message)

	var evt observability.CloudEvent[core.ProductDeletedEvent]
	jsonErr := json.Unmarshal(body, &evt)

	if jsonErr != nil {
		return "", jsonErr
	}

	span, _ := tracer.StartSpanFromContext(ctx, fmt.Sprintf("process %s", evt.Type))
	defer span.Finish()

	// Extract DSM context using the incoming ctx so the checkpoint is linked to
	// the current trace, not an orphaned background context.
	_, _ = tracer.SetDataStreamsCheckpointWithParams(datastreams.ExtractFromBase64Carrier(ctx, &evt), options.CheckpointParams{
		ServiceOverride: "productservice-publiceventpublisher",
	}, "direction:in", productcore.InternalPubSubName, "topic:"+evt.Type, "manual_checkpoint:true")

	span.SetTag("product.id", evt.Data.ProductId)
	span.SetTag("messaging.message.id", evt.Id)
	span.SetTag("messaging.message.type", evt.Type)
	span.SetTag("messaging.message.envelope.size", len(snsMessage.Message))
	span.SetTag("messaging.operation.name", "process")
	span.SetTag("messaging.operation.type", "process")
	span.SetTag("messaging.system", "aws_sqs")

	result, err := handler.HandleDeleted(ctx, evt.Data)
	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
	}
	return result, err
}

func main() {
	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
