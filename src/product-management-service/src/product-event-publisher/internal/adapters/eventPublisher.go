//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"product-event-publisher/internal/core"

	"gopkg.in/DataDog/dd-trace-go.v1/datastreams"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams/options"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"

	"github.com/aws/aws-sdk-go-v2/service/eventbridge"

	"github.com/aws/aws-sdk-go-v2/service/eventbridge/types"

	observability "github.com/datadog/serverless-sample-observability"
)

type EventBridgeEventPublisher struct {
	client eventbridge.Client
}

func NewEventBridgeEventPublisher(client eventbridge.Client) *EventBridgeEventPublisher {
	return &EventBridgeEventPublisher{client: client}
}

func (publisher EventBridgeEventPublisher) PublishProductCreated(ctx context.Context, evt core.PublicProductCreatedEventV1) error {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.productCreated.v1")
	defer span.Finish()
	cloudEvent := observability.NewCloudEvent(ctx, "product.productCreated.v1", evt)

	// Inject DSM context before marshaling so _datadog carrier is included in the message.
	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-publiceventpublisher",
	}, "direction:out", "type:sns", "topic:"+cloudEvent.Type, "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, &cloudEvent)
	}

	evtData, _ := json.Marshal(cloudEvent)
	message := string(evtData)
	detailType := cloudEvent.Type
	busName := os.Getenv("EVENT_BUS_NAME")
	source := fmt.Sprintf("%s.products", os.Getenv("ENV"))

	span.SetTag("product.id", evt.ProductId)
	span.SetTag("messaging.message.id", cloudEvent.Id)
	span.SetTag("messaging.message.type", cloudEvent.Type)
	span.SetTag("messaging.message.destination", busName)
	span.SetTag("messaging.message.envelope.size", len(message))
	span.SetTag("messaging.operation.name", "publish")
	span.SetTag("messaging.operation.type", "publish")
	span.SetTag("messaging.system", "aws_eventbridge")

	entiries := []types.PutEventsRequestEntry{
		{
			Detail:       &message,
			DetailType:   &detailType,
			EventBusName: &busName,
			Source:       &source,
		},
	}

	input := &eventbridge.PutEventsInput{
		Entries: entiries,
	}

	_, err := publisher.client.PutEvents(ctx, input)

	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		fmt.Printf("Failure publishing, error: %s\n", err)
		return fmt.Errorf("publish product.productCreated.v1: %w", err)
	}

	return nil
}

func (publisher EventBridgeEventPublisher) PublishProductUpdated(ctx context.Context, evt core.PublicProductUpdatedEventV1) error {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.productUpdated.v1")
	defer span.Finish()
	cloudEvent := observability.NewCloudEvent(ctx, "product.productUpdated.v1", evt)

	// Inject DSM context before marshaling so _datadog carrier is included in the message.
	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-publiceventpublisher",
	}, "direction:out", "type:sns", fmt.Sprintf("topic:%s", cloudEvent.Type))
	if ok {
		datastreams.InjectToBase64Carrier(ctx, &cloudEvent)
	}

	evtData, _ := json.Marshal(cloudEvent)
	message := string(evtData)
	detailType := cloudEvent.Type
	busName := os.Getenv("EVENT_BUS_NAME")
	source := fmt.Sprintf("%s.products", os.Getenv("ENV"))

	span.SetTag("product.id", evt.ProductId)
	span.SetTag("messaging.message.id", cloudEvent.Id)
	span.SetTag("messaging.message.type", cloudEvent.Type)
	span.SetTag("messaging.message.destination", busName)
	span.SetTag("messaging.message.envelope.size", len(message))
	span.SetTag("messaging.operation.name", "publish")
	span.SetTag("messaging.operation.type", "publish")
	span.SetTag("messaging.system", "aws_eventbridge")

	entiries := []types.PutEventsRequestEntry{
		{
			Detail:       &message,
			DetailType:   &detailType,
			EventBusName: &busName,
			Source:       &source,
		},
	}

	input := &eventbridge.PutEventsInput{
		Entries: entiries,
	}

	_, err := publisher.client.PutEvents(ctx, input)

	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		fmt.Printf("Failure publishing, error: %s\n", err)
		return fmt.Errorf("publish product.productUpdated.v1: %w", err)
	}

	return nil
}

func (publisher EventBridgeEventPublisher) PublishProductDeleted(ctx context.Context, evt core.PublicProductDeletedEventV1) error {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.productDeleted.v1")
	defer span.Finish()

	cloudEvent := observability.NewCloudEvent(ctx, "product.productDeleted.v1", evt)

	// Inject DSM context before marshaling so _datadog carrier is included in the message.
	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-publiceventpublisher",
	}, "direction:out", "type:sns", fmt.Sprintf("topic:%s", cloudEvent.Type))
	if ok {
		datastreams.InjectToBase64Carrier(ctx, &cloudEvent)
	}

	evtData, _ := json.Marshal(cloudEvent)
	message := string(evtData)
	detailType := cloudEvent.Type
	busName := os.Getenv("EVENT_BUS_NAME")
	source := fmt.Sprintf("%s.products", os.Getenv("ENV"))

	span.SetTag("product.id", evt.ProductId)
	span.SetTag("messaging.message.id", cloudEvent.Id)
	span.SetTag("messaging.message.type", cloudEvent.Type)
	span.SetTag("messaging.message.destination", busName)
	span.SetTag("messaging.message.envelope.size", len(message))
	span.SetTag("messaging.operation.name", "publish")
	span.SetTag("messaging.operation.type", "publish")
	span.SetTag("messaging.system", "aws_eventbridge")

	entiries := []types.PutEventsRequestEntry{
		{
			Detail:       &message,
			DetailType:   &detailType,
			EventBusName: &busName,
			Source:       &source,
		},
	}

	input := &eventbridge.PutEventsInput{
		Entries: entiries,
	}

	_, err := publisher.client.PutEvents(ctx, input)

	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		fmt.Printf("Failure publishing, error: %s\n", err)
		return fmt.Errorf("publish product.productDeleted.v1: %w", err)
	}

	return nil
}
