//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type DeleteProductCommand struct {
	ProductId string `json:"productId"`
}

type DeleteProductCommandHandler struct {
	productRepository ProductRepository
	eventPublisher    ProductEventPublisher
}

func NewDeleteProductCommandHandler(productRepository ProductRepository, eventPublisher ProductEventPublisher) *DeleteProductCommandHandler {
	return &DeleteProductCommandHandler{
		productRepository: productRepository,
		eventPublisher:    eventPublisher,
	}
}

func (handler *DeleteProductCommandHandler) Handle(ctx context.Context, command DeleteProductCommand) {
	handler.productRepository.Delete(ctx, command.ProductId)

	handler.eventPublisher.PublishProductDeleted(ctx, ProductDeletedEvent{ProductId: command.ProductId})
}
