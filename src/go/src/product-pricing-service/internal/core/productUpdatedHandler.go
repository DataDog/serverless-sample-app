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
