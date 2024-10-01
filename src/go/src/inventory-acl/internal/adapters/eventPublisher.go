package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"inventory-acl/internal/core"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/service/sns"
	"go.opentelemetry.io/otel/propagation"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type TracedMessage[T any] struct {
	Data    T                      `json:"data"`
	Datadog propagation.MapCarrier `json:"_datadog"`
}

type SnsEventPublisher struct {
	client sns.Client
}

func NewSnsEventPublisher(client sns.Client) *SnsEventPublisher {
	return &SnsEventPublisher{client: client}
}

func (publisher SnsEventPublisher) PublishProductAddedEvent(ctx context.Context, evt core.ProductAddedEvent) {
	span, _ := tracer.SpanFromContext(ctx)

	carrier := propagation.MapCarrier{}
	tracer.Inject(span.Context(), carrier)

	tracedMessage := TracedMessage[core.ProductAddedEvent]{
		Data:    evt,
		Datadog: carrier,
	}

	tracedMessageData, _ := json.Marshal(tracedMessage)
	message := string(tracedMessageData)
	topicArn := os.Getenv("PRODUCT_ADDED_TOPIC_ARN")

	fmt.Println("Publishing to '" + topicArn + "'")

	input := &sns.PublishInput{
		TopicArn: &topicArn,
		Message:  &message,
	}

	_, err := publisher.client.Publish(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}
