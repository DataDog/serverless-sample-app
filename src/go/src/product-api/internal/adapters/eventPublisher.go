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
	"log"
	"os"
	"product-api/internal/core"

	"github.com/aws/aws-sdk-go-v2/service/sns"
	"go.opentelemetry.io/otel/propagation"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type TracedMessage[T any] struct {
	Data    T                      `json:"data"`
	Datadog propagation.MapCarrier `json:"_datadog"`
}

type SnsEventPublisher struct {
	client    sns.Client
	propgator propagation.TextMapPropagator
}

func NewSnsEventPublisher(client sns.Client) *SnsEventPublisher {
	propgator := propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{})
	return &SnsEventPublisher{client: client, propgator: propgator}
}

func (publisher SnsEventPublisher) PublishProductCreated(ctx context.Context, evt core.ProductCreatedEvent) {
	span, _ := tracer.SpanFromContext(ctx)

	carrier := propagation.MapCarrier{}
	tracer.Inject(span.Context(), carrier)

	tracedMessage := TracedMessage[core.ProductCreatedEvent]{
		Data:    evt,
		Datadog: carrier,
	}

	tracedMessageData, _ := json.Marshal(tracedMessage)

	fmt.Println(string(tracedMessageData))

	message := string(tracedMessageData)
	topicArn := os.Getenv("PRODUCT_CREATED_TOPIC_ARN")

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

func (publisher SnsEventPublisher) PublishProductUpdated(ctx context.Context, evt core.ProductUpdatedEvent) {
	span, _ := tracer.SpanFromContext(ctx)

	carrier := propagation.MapCarrier{}
	tracer.Inject(span.Context(), carrier)

	tracedMessage := TracedMessage[core.ProductUpdatedEvent]{
		Data:    evt,
		Datadog: carrier,
	}

	tracedMessageData, _ := json.Marshal(tracedMessage)
	message := string(tracedMessageData)
	topicArn := os.Getenv("PRODUCT_UPDATED_TOPIC_ARN")

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

func (publisher SnsEventPublisher) PublishProductDeleted(ctx context.Context, evt core.ProductDeletedEvent) {
	span, _ := tracer.SpanFromContext(ctx)

	carrier := propagation.MapCarrier{}
	tracer.Inject(span.Context(), carrier)

	tracedMessage := TracedMessage[core.ProductDeletedEvent]{
		Data:    evt,
		Datadog: carrier,
	}

	tracedMessageData, _ := json.Marshal(tracedMessage)
	message := string(tracedMessageData)
	topicArn := os.Getenv("PRODUCT_DELETED_TOPIC_ARN")

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
