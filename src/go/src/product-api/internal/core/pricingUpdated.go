//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type PricingUpdatedEventHandler struct {
	productRepository ProductRepository
}

func NewPricingUpdatedEventHandler(productRepository ProductRepository) *PricingUpdatedEventHandler {
	return &PricingUpdatedEventHandler{
		productRepository: productRepository,
	}
}

func (handler *PricingUpdatedEventHandler) Handle(ctx context.Context, evt PriceCalculatedEvent) (*ProductDTO, error) {
	product, err := handler.productRepository.Get(ctx, evt.ProductId)

	if err != nil {
		return nil, err
	}

	product.ClearPricing()

	for index := range evt.PriceBrackets {
		bracket := evt.PriceBrackets[index]

		product.AddPrice(bracket.Quantity, bracket.Price)
	}

	handler.productRepository.Update(ctx, *product)

	return product.AsDto(), nil
}
