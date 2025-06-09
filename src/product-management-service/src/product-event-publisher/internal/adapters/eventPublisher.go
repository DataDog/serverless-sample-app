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
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams/options"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
	"log"
	"os"
	"product-event-publisher/internal/core"

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

func (publisher EventBridgeEventPublisher) PublishProductCreated(ctx context.Context, evt core.PublicProductCreatedEventV1) {
	cloudEvent := observability.NewCloudEvent(ctx, "product.productCreated.v1", evt)

	evtData, _ := json.Marshal(cloudEvent)
	message := string(evtData)
	detailType := cloudEvent.Type
	busName := os.Getenv("EVENT_BUS_NAME")
	source := fmt.Sprintf("%s.products", os.Getenv("ENV"))

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

	ctx, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{}, "direction:out", "type:sns", "topic:"+cloudEvent.Type, "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, cloudEvent)
	}

	_, err := publisher.client.PutEvents(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}

func (publisher EventBridgeEventPublisher) PublishProductUpdated(ctx context.Context, evt core.PublicProductUpdatedEventV1) {
	cloudEvent := observability.NewCloudEvent(ctx, "product.productUpdated.v1", evt)

	evtData, _ := json.Marshal(cloudEvent)
	message := string(evtData)
	detailType := cloudEvent.Type
	busName := os.Getenv("EVENT_BUS_NAME")
	source := fmt.Sprintf("%s.products", os.Getenv("ENV"))

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

	ctx, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{}, "direction:out", "type:sns", fmt.Sprintln("topic:%s", cloudEvent.Type))
	if ok {
		datastreams.InjectToBase64Carrier(ctx, cloudEvent)
	}

	_, err := publisher.client.PutEvents(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}

func (publisher EventBridgeEventPublisher) PublishProductDeleted(ctx context.Context, evt core.PublicProductDeletedEventV1) {
	cloudEvent := observability.NewCloudEvent(ctx, "product.productDeleted.v1", evt)

	evtData, _ := json.Marshal(cloudEvent)
	message := string(evtData)
	detailType := cloudEvent.Type
	busName := os.Getenv("EVENT_BUS_NAME")
	source := fmt.Sprintf("%s.products", os.Getenv("ENV"))

	entiries := []types.PutEventsRequestEntry{
		{
			Detail:       &message,
			DetailType:   &detailType,
			EventBusName: &busName,
			Source:       &source,
		},
	}

	ctx, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{}, "direction:out", "type:sns", fmt.Sprintln("topic:%s", cloudEvent.Type))
	if ok {
		datastreams.InjectToBase64Carrier(ctx, cloudEvent)
	}

	input := &eventbridge.PutEventsInput{
		Entries: entiries,
	}

	_, err := publisher.client.PutEvents(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}
