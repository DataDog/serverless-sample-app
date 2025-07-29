//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package main

import (
	"context"
	"encoding/json"
	"fmt"
	ddlambda "github.com/DataDog/datadog-lambda-go"
	"github.com/aws/aws-sdk-go-v2/aws"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"
	"log"
	"os"
	"strconv"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/service/sns"

	core "github.com/datadog/serverless-sample-product-core"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
	"product-api/internal/adapters"
)

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	productRepository, _ = adapters.NewDSqlProductRepository(os.Getenv("DSQL_CLUSTER_ENDPOINT"))
	eventPublisher       = adapters.NewSnsEventPublisher(*sns.NewFromConfig(awsCfg))
)

func processEntry(ctx context.Context, entry core.OutboxEntry, activeSpanCtx ddtrace.SpanContext) error {
	// Create span links to connect to the original trace
	spanLinks := []ddtrace.SpanLink{}

	if entry.TraceId != "" && entry.SpanId != "" {
		traceId, err := strconv.ParseUint(entry.TraceId, 10, 64)
		if err == nil {
			spanId, err := strconv.ParseUint(entry.SpanId, 10, 64)
			if err == nil {
				spanLinks = append(spanLinks, ddtrace.SpanLink{
					TraceID: traceId,
					SpanID:  spanId,
				})
			}
		}
	}

	span, _ := tracer.StartSpanFromContext(ctx,
		fmt.Sprintf("outbox.process_entry.%s", entry.EventType),
		tracer.WithSpanLinks(spanLinks),
	)
	defer span.Finish()

	span.SetTag("outbox.entry_id", entry.Id)
	span.SetTag("outbox.event_type", entry.EventType)
	span.SetTag("outbox.original_trace_id", entry.TraceId)
	span.SetTag("outbox.original_span_id", entry.SpanId)

	// Process the event based on its type
	switch entry.EventType {
	case "product.productCreated":
		var event core.ProductCreatedEvent
		if err := json.Unmarshal([]byte(entry.EventData), &event); err != nil {
			return fmt.Errorf("failed to unmarshal ProductCreatedEvent: %w", err)
		}
		eventPublisher.PublishProductCreated(ctx, event)

	case "product.productUpdated":
		var event core.ProductUpdatedEvent
		if err := json.Unmarshal([]byte(entry.EventData), &event); err != nil {
			return fmt.Errorf("failed to unmarshal ProductUpdatedEvent: %w", err)
		}
		eventPublisher.PublishProductUpdated(ctx, event)

	case "product.productDeleted":
		var event core.ProductDeletedEvent
		if err := json.Unmarshal([]byte(entry.EventData), &event); err != nil {
			return fmt.Errorf("failed to unmarshal ProductDeletedEvent: %w", err)
		}
		eventPublisher.PublishProductDeleted(ctx, event)

	default:
		log.Printf("Unknown event type: %s", entry.EventType)
		return fmt.Errorf("unknown event type: %s", entry.EventType)
	}

	// Mark as processed
	if err := productRepository.MarkAsProcessed(ctx, entry.Id); err != nil {
		return fmt.Errorf("failed to mark entry as processed: %w", err)
	}

	log.Printf("Successfully processed outbox entry %s of type %s", entry.Id, entry.EventType)
	return nil
}

type OutboxEvent struct {
	// EventBridge scheduled event structure
}

func functionHandler(ctx context.Context, event OutboxEvent) error {
	span, _ := tracer.StartSpanFromContext(ctx, "outbox.process")
	defer span.Finish()

	entries, err := productRepository.GetUnprocessedEntries(ctx)
	if err != nil {
		return fmt.Errorf("failed to get unprocessed entries: %w", err)
	}

	log.Printf("Processing %d outbox entries", len(entries))
	span.SetTag("outbox.entries", len(entries))

	for _, entry := range entries {
		if err := processEntry(ctx, entry, span.Context()); err != nil {
			log.Printf("Failed to process entry %s: %v", entry.Id, err)
			continue
		}
	}

	return nil
}

func main() {
	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
