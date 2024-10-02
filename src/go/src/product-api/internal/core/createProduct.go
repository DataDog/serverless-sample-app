//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type CreateProductCommand struct {
	Name  string  `json:"name"`
	Price float32 `json:"price"`
}

type CreateProductCommandHandler struct {
	productRepository ProductRepository
	eventPublisher    ProductEventPublisher
}

func NewCreateProductCommandHandler(productRepository ProductRepository, eventPublisher ProductEventPublisher) *CreateProductCommandHandler {
	return &CreateProductCommandHandler{
		productRepository: productRepository,
		eventPublisher:    eventPublisher,
	}
}

func (handler *CreateProductCommandHandler) Handle(ctx context.Context, command CreateProductCommand) (*ProductDTO, error) {
	product, err := NewProduct(command.Name, command.Price)

	if err != nil {
		return nil, err
	}

	err = handler.productRepository.Store(ctx, *product)

	if err != nil {
		return nil, err
	}

	handler.eventPublisher.PublishProductCreated(ctx, ProductCreatedEvent{ProductId: product.Id, Name: product.Name, Price: product.Price})

	return product.AsDto(), nil
}