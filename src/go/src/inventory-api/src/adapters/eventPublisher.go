package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"go.opentelemetry.io/otel/propagation"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
	"inventory-api/src/core/domain"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/service/eventbridge"

	"github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
)

type EventBridgeEventPublisher struct {
	client eventbridge.Client
}

func NewEventBridgeEventPublisher(client eventbridge.Client) *EventBridgeEventPublisher {
	return &EventBridgeEventPublisher{client: client}
}

func (publisher EventBridgeEventPublisher) PublishStockLevelUpdatedEvent(ctx context.Context, evt domain.StockLevelUpdatedEventV1) {
	tracedMessage := newTracedMessage(ctx, evt)

	evtData, _ := json.Marshal(tracedMessage)
	message := string(evtData)
	detailType := "inventory.stockUpdated.v1"
	busName := os.Getenv("EVENT_BUS_NAME")
	source := fmt.Sprintf("%s.inventory", os.Getenv("ENV"))

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

type TracedMessage[T any] struct {
	Data    T                      `json:"data"`
	Datadog propagation.MapCarrier `json:"_datadog"`
}

func newTracedMessage[T any](ctx context.Context, data T) TracedMessage[T] {
	span, _ := tracer.SpanFromContext(ctx)

	carrier := propagation.MapCarrier{}
	tracer.Inject(span.Context(), carrier)

	return TracedMessage[T]{
		Data:    data,
		Datadog: carrier,
	}
}
