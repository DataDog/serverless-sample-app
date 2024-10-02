//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type PricingEventPublisher interface {
	PublishPriceCalculated(ctx context.Context, evt PriceCalculatedEvent)
}

type ProductCreatedEvent struct {
	ProductId string  `json:"productId"`
	Name      string  `json:"name"`
	Price     float32 `json:"price"`
}

type ProductUpdatedEvent struct {
	ProductId string         `json:"productId"`
	Previous  ProductDetails `json:"previous"`
	New       ProductDetails `json:"new"`
}

type ProductDetails struct {
	Name  string  `json:"name"`
	Price float32 `json:"price"`
}

type PriceCalculatedEvent struct {
	ProductId     string                  `json:"productId"`
	PriceBrackets []ProductPriceBreakdown `json:"priceBrackets"`
}

type ProductPriceBreakdown struct {
	Quantity int     `json:"number"`
	Price    float32 `json:"price"`
}
