//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams"
	"gopkg.in/DataDog/dd-trace-go.v1/datastreams/options"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type DeleteProductCommand struct {
	ProductId string `json:"productId"`
}

type DeleteProductCommandHandler struct {
	productRepository ProductRepository
	outboxRepository  OutboxRepository
}

func NewDeleteProductCommandHandler(productRepository ProductRepository, outboxRepository OutboxRepository) *DeleteProductCommandHandler {
	return &DeleteProductCommandHandler{
		productRepository: productRepository,
		outboxRepository:  outboxRepository,
	}
}

func (handler *DeleteProductCommandHandler) Handle(ctx context.Context, command DeleteProductCommand) error {
	span, _ := tracer.SpanFromContext(ctx)
	span.SetTag("product.id", command.ProductId)
	event := ProductDeletedEvent{ProductId: command.ProductId}
	outboxEntry, err := createOutboxEntryForDelete(ctx, "product.productDeleted", event)
	if err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		return err
	}

	if err := handler.productRepository.DeleteProductWithOutboxEntry(ctx, command.ProductId, outboxEntry); err != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		span.SetTag("error.type", fmt.Sprintf("%T", err))
		return err
	}

	return nil
}

func createOutboxEntryForDelete(ctx context.Context, eventType string, eventData interface{}) (OutboxEntry, error) {
	span, _ := tracer.SpanFromContext(ctx)

	traceId := ""
	spanId := ""
	if span != nil {
		spanCtx := span.Context()
		traceId = fmt.Sprintf("%d", spanCtx.TraceID())
		spanId = fmt.Sprintf("%d", spanCtx.SpanID())
	}

	eventJson, err := json.Marshal(eventData)
	if err != nil {
		return OutboxEntry{}, err
	}

	entry := OutboxEntry{
		Id:        uuid.New().String(),
		EventType: eventType,
		EventData: string(eventJson),
		TraceId:   traceId,
		SpanId:    spanId,
		CreatedAt: time.Now(),
	}

	_, ok := tracer.SetDataStreamsCheckpointWithParams(ctx, options.CheckpointParams{
		ServiceOverride: "productservice-outbox",
	}, "direction:out", "type:outbox", "topic:"+eventType, "manual_checkpoint:true")
	if ok {
		carrier := make(OutboxDsmCarrier)
		datastreams.InjectToBase64Carrier(ctx, carrier)
		entry.DsmContext = map[string]string(carrier)
	}

	return entry, nil
}
