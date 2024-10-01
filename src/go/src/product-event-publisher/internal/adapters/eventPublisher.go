package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"product-event-publisher/internal/core"

	"github.com/aws/aws-sdk-go-v2/service/eventbridge"

	"github.com/aws/aws-sdk-go-v2/service/eventbridge/types"

	"github.com/datadog/serverless-sample-observability"
)

type EventBridgeEventPublisher struct {
	client eventbridge.Client
}

func NewEventBridgeEventPublisher(client eventbridge.Client) *EventBridgeEventPublisher {
	return &EventBridgeEventPublisher{client: client}
}

func (publisher EventBridgeEventPublisher) PublishProductCreated(ctx context.Context, evt core.PublicProductCreatedEventV1) {
	tracedMessage := observability.NewTracedMessage(ctx, evt)

	evtData, _ := json.Marshal(tracedMessage)
	message := string(evtData)
	detailType := "product.productCreated.v1"
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

	_, err := publisher.client.PutEvents(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}

func (publisher EventBridgeEventPublisher) PublishProductUpdated(ctx context.Context, evt core.PublicProductUpdatedEventV1) {
	tracedMessage := observability.NewTracedMessage(ctx, evt)

	evtData, _ := json.Marshal(tracedMessage)
	message := string(evtData)
	detailType := "product.productUpdated.v1"
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

	_, err := publisher.client.PutEvents(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}

func (publisher EventBridgeEventPublisher) PublishProductDeleted(ctx context.Context, evt core.PublicProductDeletedEventV1) {
	tracedMessage := observability.NewTracedMessage(ctx, evt)

	evtData, _ := json.Marshal(tracedMessage)
	message := string(evtData)
	detailType := "product.productDeleted.v1"
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

	_, err := publisher.client.PutEvents(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}
