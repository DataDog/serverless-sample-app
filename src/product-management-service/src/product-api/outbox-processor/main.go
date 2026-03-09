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
	observability "github.com/datadog/serverless-sample-observability"
	"log"
	"os"
	"strconv"
	"time"

	ddlambda "github.com/DataDog/datadog-lambda-go"
	"github.com/aws/aws-sdk-go-v2/aws"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	awstrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/aws/aws-sdk-go-v2/aws"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/service/sns"

	"product-api/internal/adapters"

	core "github.com/datadog/serverless-sample-product-core"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams/options"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

var (
	awsCfg = func() aws.Config {
		awsCfg, _ := awscfg.LoadDefaultConfig(context.TODO())
		awstrace.AppendMiddleware(&awsCfg)
		return awsCfg
	}()
	productRepository, repositoryInitErr = adapters.NewDSqlProductRepository(os.Getenv("DSQL_CLUSTER_ENDPOINT"))
	eventPublisher                       = adapters.NewSnsEventPublisher(*sns.NewFromConfig(awsCfg))
)

func processEntry(ctx context.Context, entry core.OutboxEntry, activeSpanCtx ddtrace.SpanContext) error {
	// Restore DSM pathway from the outbox entry and emit the consume checkpoint.
	if len(entry.DsmContext) > 0 {
		ctx = datastreams.ExtractFromBase64Carrier(ctx, core.OutboxDsmCarrier(entry.DsmContext))
	}
	tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-outbox",
	}, "direction:in", core.InternalOutboxName, "topic:"+entry.EventType, "manual_checkpoint:true")

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
		fmt.Sprintf("outbox %s", entry.EventType),
		tracer.WithSpanLinks(spanLinks),
		tracer.ChildOf(activeSpanCtx),
	)
	defer span.Finish()

	span.SetTag("outbox.entry_id", entry.Id)
	span.SetTag("outbox.event_type", entry.EventType)
	if entry.TraceId != "" && entry.SpanId != "" {
		traceId, err := strconv.ParseUint(entry.TraceId, 10, 64)
		if err == nil {
			spanId, err := strconv.ParseUint(entry.SpanId, 10, 64)
			if err == nil {
				span.SetTag("outbox.original_trace_id", fmt.Sprintf("%d", traceId))
				span.SetTag("outbox.original_span_id", fmt.Sprintf("%d", spanId))
			}
		}
	}

	// Process the event based on its type
	switch entry.EventType {
	case "product.productCreated":
		var event core.ProductCreatedEvent
		if err := json.Unmarshal([]byte(entry.EventData), &event); err != nil {
			span.SetTag("error", true)
			span.SetTag("error.message", err.Error())
			span.SetTag("error.type", fmt.Sprintf("%T", err))
			return fmt.Errorf("failed to unmarshal ProductCreatedEvent: %w", err)
		}
		span.SetTag("product.id", event.ProductId)

		observability.TrackTransaction(ctx, observability.TransactionEvent{
			TransactionID:  event.ProductId,
			Checkpoint:     "product_created",
			TimestampNanos: strconv.FormatInt(time.Now().UnixNano(), 10),
		})

		if err := eventPublisher.PublishProductCreated(ctx, event); err != nil {
			span.SetTag("error", true)
			span.SetTag("error.message", err.Error())
			span.SetTag("error.type", fmt.Sprintf("%T", err))
			return err
		}

	case "product.productUpdated":
		var event core.ProductUpdatedEvent
		if err := json.Unmarshal([]byte(entry.EventData), &event); err != nil {
			span.SetTag("error", true)
			span.SetTag("error.message", err.Error())
			span.SetTag("error.type", fmt.Sprintf("%T", err))
			return fmt.Errorf("failed to unmarshal ProductUpdatedEvent: %w", err)
		}
		span.SetTag("product.id", event.ProductId)

		observability.TrackTransaction(ctx, observability.TransactionEvent{
			TransactionID:  event.ProductId,
			Checkpoint:     "product_updated",
			TimestampNanos: strconv.FormatInt(time.Now().UnixNano(), 10),
		})

		if err := eventPublisher.PublishProductUpdated(ctx, event); err != nil {
			span.SetTag("error", true)
			span.SetTag("error.message", err.Error())
			span.SetTag("error.type", fmt.Sprintf("%T", err))
			return err
		}

	case "product.productDeleted":
		var event core.ProductDeletedEvent
		if err := json.Unmarshal([]byte(entry.EventData), &event); err != nil {
			span.SetTag("error", true)
			span.SetTag("error.message", err.Error())
			span.SetTag("error.type", fmt.Sprintf("%T", err))
			return fmt.Errorf("failed to unmarshal ProductDeletedEvent: %w", err)
		}
		span.SetTag("product.id", event.ProductId)

		observability.TrackTransaction(ctx, observability.TransactionEvent{
			TransactionID:  event.ProductId,
			Checkpoint:     "product_deleted",
			TimestampNanos: strconv.FormatInt(time.Now().UnixNano(), 10),
		})

		if err := eventPublisher.PublishProductDeleted(ctx, event); err != nil {
			span.SetTag("error", true)
			span.SetTag("error.message", err.Error())
			span.SetTag("error.type", fmt.Sprintf("%T", err))
			return err
		}

	default:
		log.Printf("Unknown event type: %s", entry.EventType)
		span.SetTag("event.event_type", entry.EventType)
		span.SetTag("error", true)
		span.SetTag("error.message", fmt.Sprintf("unknown event type: %s", entry.EventType))
		span.SetTag("error.type", "*errors.errorString")
		return fmt.Errorf("unknown event type: %s", entry.EventType)
	}

	// Mark as processed
	if err := productRepository.MarkAsProcessed(ctx, entry.Id); err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		return fmt.Errorf("failed to mark entry as processed: %w", err)
	}

	log.Printf("Successfully processed outbox entry %s of type %s", entry.Id, entry.EventType)
	return nil
}

type OutboxEvent struct {
	// EventBridge scheduled event structure
}

func functionHandler(ctx context.Context, event OutboxEvent) error {
	// Get the span injected by ddlambda.WrapFunction — do NOT call span.Finish()
	// as ddlambda owns its lifecycle.
	span, _ := tracer.SpanFromContext(ctx)

	entries, err := productRepository.GetUnprocessedEntries(ctx)
	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		return fmt.Errorf("failed to get unprocessed entries: %w", err)
	}

	span.SetTag("outbox.entries", len(entries))

	var hadFailures bool
	for _, entry := range entries {
		if err := processEntry(ctx, entry, span.Context()); err != nil {
			log.Printf("Failed to process entry %s: %v", entry.Id, err)
			hadFailures = true
		}
	}

	if hadFailures {
		span.SetTag("outbox.had_failures", true)
		return fmt.Errorf("one or more outbox entries failed to process")
	}

	return nil
}

func main() {
	if repositoryInitErr != nil {
		panic(repositoryInitErr)
	}

	if err := productRepository.ApplyMigrations(context.Background()); err != nil {
		panic(err)
	}

	lambda.Start(ddlambda.WrapFunction(functionHandler, nil))
}
