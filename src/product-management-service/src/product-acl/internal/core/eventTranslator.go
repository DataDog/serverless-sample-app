//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package productaclcore

import (
	"context"

	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type ProductEventTranslator struct {
	eventPublisher PrivateEventPublisher
}

func NewProductEventTranslator(eventPublisher PrivateEventPublisher) *ProductEventTranslator {
	return &ProductEventTranslator{
		eventPublisher: eventPublisher,
	}
}

func (handler *ProductEventTranslator) HandleStockUpdated(ctx context.Context, evt PublicInventoryStockUpdatedEventV1) (string, error) {
	span, _ := tracer.SpanFromContext(ctx)
	defer span.Finish()
	span.SetTag("product.id", evt.ProductId)
	handler.eventPublisher.PublishStockUpdatedEvent(ctx, FromPublicInventoryStockUpdatedEvent(evt))

	return "OK", nil
}

func (handler *ProductEventTranslator) HandleProductPricingChanged(ctx context.Context, evt PublicPricingUpdatedEventV1) (string, error) {
	span, _ := tracer.SpanFromContext(ctx)
	defer span.Finish()
	span.SetTag("product.id", evt.ProductId)
	handler.eventPublisher.PublishPricingChangedEvent(ctx, FromPublicPricingUpdatedEvent(evt))

	return "OK", nil
}
