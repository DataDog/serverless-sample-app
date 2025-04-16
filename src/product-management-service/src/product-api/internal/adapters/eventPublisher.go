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

	core "github.com/datadog/serverless-sample-product-core"

	"github.com/aws/aws-sdk-go-v2/service/sns"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"

	observability "github.com/datadog/serverless-sample-observability"
)

type SnsEventPublisher struct {
	client sns.Client
}

func NewSnsEventPublisher(client sns.Client) *SnsEventPublisher {
	return &SnsEventPublisher{client: client}
}

func (publisher SnsEventPublisher) PublishProductCreated(ctx context.Context, evt core.ProductCreatedEvent) {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.productCreated")
	defer span.Finish()

	_, spanWasFound := tracer.SpanFromContext(ctx)

	if !spanWasFound {
		fmt.Println("EventPublisher: No span found in current context")
	}

	cloudEvent := observability.NewCloudEvent(ctx, "product.productCreated", evt)

	fmt.Println(cloudEvent.TraceParent)

	tracedMessageData, _ := json.Marshal(cloudEvent)

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
	_, _ = tracer.SpanFromContext(ctx)

	cloudEvent := observability.NewCloudEvent(ctx, "product.productUpdated", evt)

	tracedMessageData, _ := json.Marshal(cloudEvent)
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
	_, _ = tracer.SpanFromContext(ctx)

	cloudEvent := observability.NewCloudEvent(ctx, "product.productDeleted", evt)

	tracedMessageData, _ := json.Marshal(cloudEvent)
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
