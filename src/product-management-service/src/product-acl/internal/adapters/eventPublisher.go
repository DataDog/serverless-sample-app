//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package productacladapters

import (
	"context"
	"encoding/json"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams/options"
	"log"
	"os"

	core "github.com/datadog/serverless-sample-product-core"

	"github.com/aws/aws-sdk-go-v2/service/sns"
	observability "github.com/datadog/serverless-sample-observability"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type SnsEventPublisher struct {
	client sns.Client
}

func NewSnsEventPublisher(client sns.Client) *SnsEventPublisher {
	return &SnsEventPublisher{client: client}
}

func (publisher SnsEventPublisher) PublishStockUpdatedEvent(ctx context.Context, evt core.StockUpdatedEvent) {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.stockUpdated")
	defer span.Finish()

	cloudEvent := observability.NewCloudEvent(ctx, "product.stockUpdated", evt)

	tracedMessageData, _ := json.Marshal(cloudEvent)

	message := string(tracedMessageData)
	topicArn := os.Getenv("STOCK_LEVEL_UPDATED_TOPIC_ARN")

	span.SetTag("product.id", evt.ProductId)
	span.SetTag("messaging.message.id", cloudEvent.Id)
	span.SetTag("messaging.message.type", cloudEvent.Type)
	span.SetTag("messaging.message.destination", topicArn)
	span.SetTag("messaging.message.envelope.size", len(message))
	span.SetTag("messaging.operation.name", "publish")
	span.SetTag("messaging.operation.type", "publish")
	span.SetTag("messaging.system", "aws_sns")

	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-acl",
	}, "direction:out", "type:sns", "topic:product.stockUpdated", "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, cloudEvent)
	}

	input := &sns.PublishInput{
		TopicArn: &topicArn,
		Message:  &message,
	}

	_, err := publisher.client.Publish(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}

func (publisher SnsEventPublisher) PublishPricingChangedEvent(ctx context.Context, evt core.PriceCalculatedEvent) {
	span, _ := tracer.StartSpanFromContext(ctx, "publish product.pricingChanged")
	defer span.Finish()

	cloudEvent := observability.NewCloudEvent(ctx, "product.pricingChanged", evt)

	tracedMessageData, _ := json.Marshal(cloudEvent)

	message := string(tracedMessageData)
	topicArn := os.Getenv("PRICE_CALCULATED_TOPIC_ARN")

	span.SetTag("product.id", evt.ProductId)
	span.SetTag("messaging.message.id", cloudEvent.Id)
	span.SetTag("messaging.message.type", cloudEvent.Type)
	span.SetTag("messaging.message.destination", topicArn)
	span.SetTag("messaging.message.envelope.size", len(message))
	span.SetTag("messaging.operation.name", "publish")
	span.SetTag("messaging.operation.type", "publish")
	span.SetTag("messaging.system", "aws_sns")

	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-acl",
	}, "direction:out", "type:sns", "topic:product.pricingChanged", "manual_checkpoint:true")
	if ok {
		datastreams.InjectToBase64Carrier(ctx, cloudEvent)
	}

	input := &sns.PublishInput{
		TopicArn: &topicArn,
		Message:  &message,
	}

	_, err := publisher.client.Publish(ctx, input)

	if err != nil {
		log.Fatalf("Failure publishing, error: %s", err)
	}
}
