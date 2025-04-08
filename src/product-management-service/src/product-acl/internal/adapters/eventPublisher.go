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
	"fmt"
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
	_, _ = tracer.SpanFromContext(ctx)

	cloudEvent := observability.NewCloudEvent(ctx, "product.productCreated", evt)

	tracedMessageData, _ := json.Marshal(cloudEvent)

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

func (publisher SnsEventPublisher) PublishPricingChangedEvent(ctx context.Context, evt core.PriceCalculatedEvent) {
	_, _ = tracer.SpanFromContext(ctx)

	cloudEvent := observability.NewCloudEvent(ctx, "product.productCreated", evt)

	tracedMessageData, _ := json.Marshal(cloudEvent)

	message := string(tracedMessageData)
	topicArn := os.Getenv("PRICE_CALCULATED_TOPIC_ARN")

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
