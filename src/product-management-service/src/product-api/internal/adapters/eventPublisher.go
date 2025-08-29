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

	cloudEvent := observability.NewCloudEvent(ctx, "product.productCreated", evt)

	fmt.Println(cloudEvent.TraceParent)

	tracedMessageData, _ := json.Marshal(cloudEvent)

	message := string(tracedMessageData)
	topicArn := os.Getenv("PRODUCT_CREATED_TOPIC_ARN")

	span.SetTag("product.id", evt.ProductId)
	span.SetTag("messaging.message.id", cloudEvent.Id)
	span.SetTag("messaging.message.type", cloudEvent.Type)
	span.SetTag("messaging.message.destination", topicArn)
	span.SetTag("messaging.message.envelope.size", len(message))
	span.SetTag("messaging.operation.name", "publish")
	span.SetTag("messaging.operation.type", "publish")
	span.SetTag("messaging.system", "aws_sns")

	input := &sns.PublishInput{
		TopicArn: &topicArn,
		Message:  &message,
	}

	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-outbox",
	}, "direction:out", "type:sns", "topic:"+cloudEvent.Type, "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, cloudEvent)
	}

	_, err := publisher.client.Publish(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}

}

func (publisher SnsEventPublisher) PublishProductUpdated(ctx context.Context, evt core.ProductUpdatedEvent) {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.productUpdated")
	defer span.Finish()

	cloudEvent := observability.NewCloudEvent(ctx, "product.productUpdated", evt)

	tracedMessageData, _ := json.Marshal(cloudEvent)
	message := string(tracedMessageData)
	topicArn := os.Getenv("PRODUCT_UPDATED_TOPIC_ARN")

	span.SetTag("product.id", evt.ProductId)
	span.SetTag("messaging.message.id", cloudEvent.Id)
	span.SetTag("messaging.message.type", cloudEvent.Type)
	span.SetTag("messaging.message.destination", topicArn)
	span.SetTag("messaging.message.envelope.size", len(message))
	span.SetTag("messaging.operation.name", "publish")
	span.SetTag("messaging.operation.type", "publish")
	span.SetTag("messaging.system", "aws_sns")

	input := &sns.PublishInput{
		TopicArn: &topicArn,
		Message:  &message,
	}

	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-outbox",
	}, "direction:out", "type:sns", "topic:"+cloudEvent.Type, "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, cloudEvent)
	}

	_, err := publisher.client.Publish(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}

func (publisher SnsEventPublisher) PublishProductDeleted(ctx context.Context, evt core.ProductDeletedEvent) {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.productDeleted")
	defer span.Finish()

	cloudEvent := observability.NewCloudEvent(ctx, "product.productDeleted", evt)

	tracedMessageData, _ := json.Marshal(cloudEvent)
	message := string(tracedMessageData)
	topicArn := os.Getenv("PRODUCT_DELETED_TOPIC_ARN")

	span.SetTag("product.id", evt.ProductId)
	span.SetTag("messaging.message.id", cloudEvent.Id)
	span.SetTag("messaging.message.type", cloudEvent.Type)
	span.SetTag("messaging.message.destination", topicArn)
	span.SetTag("messaging.message.envelope.size", len(message))
	span.SetTag("messaging.operation.name", "publish")
	span.SetTag("messaging.operation.type", "publish")
	span.SetTag("messaging.system", "aws_sns")

	input := &sns.PublishInput{
		TopicArn: &topicArn,
		Message:  &message,
	}

	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-outbox",
	}, "direction:out", "type:sns", "topic:"+cloudEvent.Type, "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, cloudEvent)
	}

	_, err := publisher.client.Publish(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}
