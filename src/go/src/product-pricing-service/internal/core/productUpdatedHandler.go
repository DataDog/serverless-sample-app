//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import (
	"context"
	"fmt"

	"github.com/DataDog/appsec-internal-go/log"
)

type ProductUpdatedEventHandler struct {
	pricingService PricingService
	eventPublisher PricingEventPublisher
}

func NewProductUpdatedEventHandler(eventPublisher PricingEventPublisher, pricingService PricingService) *ProductUpdatedEventHandler {
	return &ProductUpdatedEventHandler{
		eventPublisher: eventPublisher,
		pricingService: pricingService,
	}
}

func (handler *ProductUpdatedEventHandler) Handle(ctx context.Context, evt ProductUpdatedEvent) (string, error) {
	if len(evt.ProductId) <= 0 {
		log.Errorf("Cannot handle event with a missing productId")
		return "", &MissingProductIdError{}
	}

	priceBreakdowns, err := handler.pricingService.calculatePricesFor(evt.New.Price)

	if err != nil {
		log.Warn(fmt.Sprintf("Pricing service handled event with a price less than or equal to zero: %s", evt.ProductId))
		return "", err
	}

	priceBrackets := []ProductPriceBreakdown{}

	for index := range priceBreakdowns {
		priceBrackets = append(priceBrackets, ProductPriceBreakdown{
			Price:    priceBreakdowns[index].price,
			Quantity: priceBreakdowns[index].quantityToOrder,
		})
	}

	handler.eventPublisher.PublishPriceCalculated(ctx, PriceCalculatedEvent{
		ProductId:     evt.ProductId,
		PriceBrackets: priceBrackets,
	})

	return "OK", nil
}
