//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type ProductStockUpdatedEventHandler struct {
	productRepository ProductRepository
}

func NewProductStockUpdatedEventHandler(productRepository ProductRepository) *ProductStockUpdatedEventHandler {
	return &ProductStockUpdatedEventHandler{
		productRepository: productRepository,
	}
}

func (handler *ProductStockUpdatedEventHandler) Handle(ctx context.Context, evt StockUpdatedEvent) (*ProductDTO, error) {
	product, err := handler.productRepository.Get(ctx, evt.ProductId)

	if err != nil {
		return nil, err
	}

	product.UpdateStockLevel(evt.StockLevel)

	handler.productRepository.Update(ctx, *product)

	return product.AsDto(), nil
}
