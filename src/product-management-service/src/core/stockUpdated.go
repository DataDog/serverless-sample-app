//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import (
	"context"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type ProductStockUpdatedEventHandler struct {
	productRepository ProductRepository
}

func NewProductStockUpdatedEventHandler(productRepository ProductRepository) *ProductStockUpdatedEventHandler {
	return &ProductStockUpdatedEventHandler{
		productRepository: productRepository,
	}
}

func (handler *ProductStockUpdatedEventHandler) Handle(ctx context.Context, evt StockUpdatedEvent) (*ProductDTO, error) {
	span, _ := tracer.SpanFromContext(ctx)
	span.SetTag("product.id", evt.ProductId)

	product, err := handler.productRepository.Get(ctx, evt.ProductId)

	if err != nil {

		span.SetTag("error", true)
		span.SetTag("error.message", err.Error())
		return nil, err
	}

	product.UpdateStockLevel(evt.StockLevel)

	updateErr := handler.productRepository.Update(ctx, *product)

	if updateErr != nil {
		span.SetTag("error", true)
		span.SetTag("error.message", updateErr.Error())

		return nil, err
	}

	return product.AsDto(), nil
}
