//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package adapters

import (
	"context"
	"fmt"
	"os"

	"gopkg.in/DataDog/dd-trace-go.v1/datastreams"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams/options"

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

func (publisher SnsEventPublisher) PublishProductCreated(ctx context.Context, evt core.ProductCreatedEvent) error {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.productCreated")
	defer span.Finish()

	cloudEvent := observability.NewCloudEvent(ctx, "product.productCreated", evt)

	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-outbox",
	}, "direction:out", core.InternalPubSubName, "topic:"+cloudEvent.Type, "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, &cloudEvent)
	}

	tracedMessageData, _ := cloudEvent.ToJSON()

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

	_, err := publisher.client.Publish(ctx, input)

	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		fmt.Printf("Failure publishing, error: %s\n", err)
		return fmt.Errorf("publish product.productCreated: %w", err)
	}

	return nil
}

func (publisher SnsEventPublisher) PublishProductUpdated(ctx context.Context, evt core.ProductUpdatedEvent) error {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.productUpdated")
	defer span.Finish()

	cloudEvent := observability.NewCloudEvent(ctx, "product.productUpdated", evt)

	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-outbox",
	}, "direction:out", core.InternalPubSubName, "topic:"+cloudEvent.Type, "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, &cloudEvent)
	}

	tracedMessageData, _ := cloudEvent.ToJSON()
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

	_, err := publisher.client.Publish(ctx, input)

	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		fmt.Printf("Failure publishing, error: %s\n", err)
		return fmt.Errorf("publish product.productUpdated: %w", err)
	}

	return nil
}

func (publisher SnsEventPublisher) PublishProductDeleted(ctx context.Context, evt core.ProductDeletedEvent) error {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.productDeleted")
	defer span.Finish()

	cloudEvent := observability.NewCloudEvent(ctx, "product.productDeleted", evt)

	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-outbox",
	}, "direction:out", core.InternalPubSubName, "topic:"+cloudEvent.Type, "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, &cloudEvent)
	}

	tracedMessageData, _ := cloudEvent.ToJSON()
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

	_, err := publisher.client.Publish(ctx, input)

	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		fmt.Printf("Failure publishing, error: %s\n", err)
		return fmt.Errorf("publish product.productDeleted: %w", err)
	}

	return nil
}
