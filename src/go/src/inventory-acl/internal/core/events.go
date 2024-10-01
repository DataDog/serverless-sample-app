package core

import "context"

type PublicProductCreatedEventV1 struct {
	ProductId string `json:"productId"`
}

type PrivateEventPublisher interface {
	PublishProductAddedEvent(ctx context.Context, evt ProductAddedEvent)
}

type ProductAddedEvent struct {
	ProductId string `json:"productId"`
}

func FromPublisProductCreatedEvent(evt PublicProductCreatedEventV1) ProductAddedEvent {
	return ProductAddedEvent{
		ProductId: evt.ProductId,
	}
}
