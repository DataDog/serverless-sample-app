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
	"product-acl/internal/core"

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

func (publisher SnsEventPublisher) PublishStockUpdatedEvent(ctx context.Context, evt core.StockUpdatedEvent) {
	span, _ := tracer.SpanFromContext(ctx)

	carrier := propagation.MapCarrier{}
	tracer.Inject(span.Context(), carrier)

	tracedMessage := TracedMessage[core.StockUpdatedEvent]{
		Data:    evt,
		Datadog: carrier,
	}

	tracedMessageData, _ := json.Marshal(tracedMessage)
	message := string(tracedMessageData)
	topicArn := os.Getenv("STOCK_LEVEL_UPDATED_TOPIC_ARN")

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
