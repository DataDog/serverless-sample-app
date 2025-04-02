//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type ListProductsQuery struct {
}

type ListProductsQueryHandler struct {
	productRepository ProductRepository
}

func NewListProductsQueryHandler(productRepository ProductRepository) *ListProductsQueryHandler {
	return &ListProductsQueryHandler{
		productRepository: productRepository,
	}
}

func (handler *ListProductsQueryHandler) Handle(ctx context.Context, command ListProductsQuery) ([]ProductListDTO, error) {
	products, err := handler.productRepository.List(ctx)

	listResponse := []ProductListDTO{}

	if err != nil {
		return listResponse, err
	}

	for _, element := range products {
		listResponse = append(listResponse, *element.AsListDto())
	}

	return listResponse, nil
}
