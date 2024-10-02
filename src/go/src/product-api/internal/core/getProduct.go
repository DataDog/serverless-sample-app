//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type GetProductQuery struct {
	ProductId string `json:"productId"`
}

type GetProductQueryHandler struct {
	productRepository ProductRepository
}

func NewGetProductQueryHandler(productRepository ProductRepository) *GetProductQueryHandler {
	return &GetProductQueryHandler{
		productRepository: productRepository,
	}
}

func (handler *GetProductQueryHandler) Handle(ctx context.Context, command GetProductQuery) (*ProductDTO, error) {
	product, err := handler.productRepository.Get(ctx, command.ProductId)

	if err != nil {
		return nil, err
	}

	return product.AsDto(), nil
}
