//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import (
	"context"
	core "github.com/datadog/serverless-sample-product-core"
)

type PublicInventoryStockUpdatedEventV1 struct {
	ProductId     string  `json:"productId"`
	NewStockLevel float32 `json:"newStockLevel"`
}

type PublicPricingUpdatedEventV1 struct {
	ProductId     string          `json:"productId"`
	PriceBrackets []PriceBrackets `json:"priceBrackets"`
}

type PriceBrackets struct {
	Price    float32 `json:"price"`
	Quantity int     `json:"quantity"`
}

type PrivateEventPublisher interface {
	PublishStockUpdatedEvent(ctx context.Context, evt core.StockUpdatedEvent)
	PublishPricingChangedEvent(ctx context.Context, evt core.PriceCalculatedEvent)
}

func FromPublicInventoryStockUpdatedEvent(evt PublicInventoryStockUpdatedEventV1) core.StockUpdatedEvent {
	return core.StockUpdatedEvent{
		ProductId:  evt.ProductId,
		StockLevel: evt.NewStockLevel,
	}
}

func FromPublicPricingUpdatedEvent(evt PublicPricingUpdatedEventV1) core.PriceCalculatedEvent {
	priceBrackets := make([]core.ProductPriceBreakdown, len(evt.PriceBrackets))
	for i, pb := range evt.PriceBrackets {
		priceBrackets[i] = core.ProductPriceBreakdown{
			Price:    pb.Price,
			Quantity: pb.Quantity,
		}
	}

	return core.PriceCalculatedEvent{
		ProductId:     evt.ProductId,
		PriceBrackets: priceBrackets,
	}
}
