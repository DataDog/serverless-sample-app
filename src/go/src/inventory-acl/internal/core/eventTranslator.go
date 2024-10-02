//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type ProductEventTranslator struct {
	eventPublisher PrivateEventPublisher
}

func NewProductEventTranslator(eventPublisher PrivateEventPublisher) *ProductEventTranslator {
	return &ProductEventTranslator{
		eventPublisher: eventPublisher,
	}
}

func (handler *ProductEventTranslator) HandleCreated(ctx context.Context, evt PublicProductCreatedEventV1) (string, error) {
	handler.eventPublisher.PublishProductAddedEvent(ctx, FromPublisProductCreatedEvent(evt))

	return "OK", nil
}
