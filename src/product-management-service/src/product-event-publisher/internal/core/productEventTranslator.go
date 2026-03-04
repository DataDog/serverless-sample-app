//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import "context"

type ProductEventTranslator struct {
	eventPublisher PublicEventPublisher
}

func NewProductEventTranslator(eventPublisher PublicEventPublisher) *ProductEventTranslator {
	return &ProductEventTranslator{
		eventPublisher: eventPublisher,
	}
}

func (handler *ProductEventTranslator) HandleCreated(ctx context.Context, evt ProductCreatedEvent) (string, error) {
	if err := handler.eventPublisher.PublishProductCreated(ctx, FromProductCreatedEvent(evt)); err != nil {
		return "", err
	}

	return "OK", nil
}

func (handler *ProductEventTranslator) HandleUpdated(ctx context.Context, evt ProductUpdatedEvent) (string, error) {
	if err := handler.eventPublisher.PublishProductUpdated(ctx, FromProductUpdatedEvent(evt)); err != nil {
		return "", err
	}

	return "OK", nil
}

func (handler *ProductEventTranslator) HandleDeleted(ctx context.Context, evt ProductDeletedEvent) (string, error) {
	if err := handler.eventPublisher.PublishProductDeleted(ctx, FromProductDeletedEvent(evt)); err != nil {
		return "", err
	}

	return "OK", nil
}
