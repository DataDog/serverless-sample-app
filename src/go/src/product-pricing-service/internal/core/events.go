package core

import "context"

type PricingEventPublisher interface {
	PublishPriceCalculated(ctx context.Context, evt PriceCalculatedEvent)
}

type ProductCreatedEvent struct {
	ProductId string  `json:"productId"`
	Name      string  `json:"name"`
	Price     float32 `json:"price"`
}

type ProductUpdatedEvent struct {
	ProductId string         `json:"productId"`
	Previous  ProductDetails `json:"previous"`
	New       ProductDetails `json:"new"`
}

type ProductDetails struct {
	Name  string  `json:"name"`
	Price float32 `json:"price"`
}

type PriceCalculatedEvent struct {
	ProductId     string                  `json:"productId"`
	PriceBrackets []ProductPriceBreakdown `json:"priceBrackets"`
}

type ProductPriceBreakdown struct {
	Quantity int     `json:"number"`
	Price    float32 `json:"price"`
}
