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
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type UpdateProductCommand struct {
	ProductId string  `json:"id"`
	Name      string  `json:"name"`
	Price     float32 `json:"price"`
}

type UpdateProductCommandHandler struct {
	productRepository ProductRepository
	outboxRepository  OutboxRepository
}

func NewUpdateProductCommandHandler(productRepository ProductRepository, outboxRepository OutboxRepository) *UpdateProductCommandHandler {
	return &UpdateProductCommandHandler{
		productRepository: productRepository,
		outboxRepository:  outboxRepository,
	}
}

func (handler *UpdateProductCommandHandler) Handle(ctx context.Context, command UpdateProductCommand) (*ProductDTO, error) {
	span, _ := tracer.SpanFromContext(ctx)
	span.SetTag("product.id", command.ProductId)
	
	product, err := handler.productRepository.Get(ctx, command.ProductId)

	if err != nil {
		return nil, err
	}

	err = product.UpdateDetail(command.Name, command.Price)

	if err != nil {
		return nil, err
	}

	if !product.Updated {
		return product.AsDto(), &UpdateNotRequiredError{}
	}

	event := ProductUpdatedEvent{ProductId: command.ProductId, New: ProductDetails{Name: product.Name, Price: product.Price}, Previous: ProductDetails{Name: product.PreviousName, Price: product.PreviousPrice}}
	outboxEntry, err := createOutboxEntryForUpdate(ctx, "product.productUpdated", event)
	if err != nil {
		return nil, err
	}

	err = handler.productRepository.UpdateProductWithOutboxEntry(ctx, *product, outboxEntry)

	if err != nil {
		return nil, err
	}

	return product.AsDto(), nil
}

func createOutboxEntryForUpdate(ctx context.Context, eventType string, eventData interface{}) (OutboxEntry, error) {
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

	return OutboxEntry{
		Id:        uuid.New().String(),
		EventType: eventType,
		EventData: string(eventJson),
		TraceId:   traceId,
		SpanId:    spanId,
		CreatedAt: time.Now(),
	}, nil
}
