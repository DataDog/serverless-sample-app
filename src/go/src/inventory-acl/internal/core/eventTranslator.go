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
