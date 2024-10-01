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
	handler.eventPublisher.PublishProductCreated(ctx, FromProductCreatedEvent(evt))

	return "OK", nil
}

func (handler *ProductEventTranslator) HandleUpdated(ctx context.Context, evt ProductUpdatedEvent) (string, error) {
	handler.eventPublisher.PublishProductUpdated(ctx, FromProductUpdatedEvent(evt))

	return "OK", nil
}

func (handler *ProductEventTranslator) HandleDeleted(ctx context.Context, evt ProductDeletedEvent) (string, error) {
	handler.eventPublisher.PublishProductDeleted(ctx, FromProductDeletedEvent(evt))

	return "OK", nil
}
