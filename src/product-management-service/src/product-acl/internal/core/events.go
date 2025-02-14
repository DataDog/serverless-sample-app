//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type PublicInventoryStockUpdatedEventV1 struct {
	ProductId     string  `json:"productId"`
	NewStockLevel float32 `json:"newStockLevel"`
}

type PrivateEventPublisher interface {
	PublishStockUpdatedEvent(ctx context.Context, evt StockUpdatedEvent)
}

type StockUpdatedEvent struct {
	ProductId  string  `json:"productId"`
	StockLevel float32 `json:"stockLevel"`
}

func FromPublicInventoryStockUpdatedEvent(evt PublicInventoryStockUpdatedEventV1) StockUpdatedEvent {
	return StockUpdatedEvent{
		ProductId:  evt.ProductId,
		StockLevel: evt.NewStockLevel,
	}
}
