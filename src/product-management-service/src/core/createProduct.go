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

type CreateProductCommand struct {
	Name  string  `json:"name"`
	Price float32 `json:"price"`
}

type CreateProductCommandHandler struct {
	productRepository ProductRepository
	outboxRepository  OutboxRepository
}

func NewCreateProductCommandHandler(productRepository ProductRepository, outboxRepository OutboxRepository) CreateProductCommandHandler {
	return CreateProductCommandHandler{
		productRepository: productRepository,
		outboxRepository:  outboxRepository,
	}
}

func (handler *CreateProductCommandHandler) Handle(ctx context.Context, command CreateProductCommand) (*ProductDTO, error) {
	span, _ := tracer.SpanFromContext(ctx)
	span.SetTag("product.name", command.Name)
	span.SetTag("product.price", command.Name)

	product, err := NewProduct(command.Name, command.Price)

	if err != nil {
		return nil, err
	}

	existingProduct, _ := handler.productRepository.Get(ctx, product.Id)

	if existingProduct != nil {
		return existingProduct.AsDto(), nil
	}

	event := ProductCreatedEvent{ProductId: product.Id, Name: product.Name, Price: product.Price}
	outboxEntry, err := createOutboxEntry(ctx, "product.productCreated", event)
	if err != nil {
		return nil, err
	}

	err = handler.productRepository.StoreProductWithOutboxEntry(ctx, *product, outboxEntry)

	if err != nil {
		return nil, err
	}

	span.SetTag("product.id", product.Id)

	return product.AsDto(), nil
}

func createOutboxEntry(ctx context.Context, eventType string, eventData interface{}) (OutboxEntry, error) {
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
