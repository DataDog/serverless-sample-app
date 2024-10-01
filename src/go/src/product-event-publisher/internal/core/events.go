package core

import "context"

type PublicEventPublisher interface {
	PublishProductCreated(ctx context.Context, evt PublicProductCreatedEventV1)
	PublishProductUpdated(ctx context.Context, evt PublicProductUpdatedEventV1)
	PublishProductDeleted(ctx context.Context, evt PublicProductDeletedEventV1)
}

func FromProductCreatedEvent(evt ProductCreatedEvent) PublicProductCreatedEventV1 {
	return PublicProductCreatedEventV1{
		ProductId: evt.ProductId,
	}
}

func FromProductUpdatedEvent(evt ProductUpdatedEvent) PublicProductUpdatedEventV1 {
	return PublicProductUpdatedEventV1{
		ProductId: evt.ProductId,
	}
}

func FromProductDeletedEvent(evt ProductDeletedEvent) PublicProductDeletedEventV1 {
	return PublicProductDeletedEventV1{
		ProductId: evt.ProductId,
	}
}

type PublicProductCreatedEventV1 struct {
	ProductId string `json:"productId"`
}

type PublicProductUpdatedEventV1 struct {
	ProductId string `json:"productId"`
}

type PublicProductDeletedEventV1 struct {
	ProductId string `json:"productId"`
}

type ProductCreatedEvent struct {
	ProductId string `json:"productId"`
}

type ProductUpdatedEvent struct {
	ProductId string `json:"productId"`
}

type ProductDeletedEvent struct {
	ProductId string `json:"productId"`
}
