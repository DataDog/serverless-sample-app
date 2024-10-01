package core

import "context"

type PricingUpdatedEventHandler struct {
	productRepository ProductRepository
}

func NewPricingUpdatedEventHandler(productRepository ProductRepository) *PricingUpdatedEventHandler {
	return &PricingUpdatedEventHandler{
		productRepository: productRepository,
	}
}

func (handler *PricingUpdatedEventHandler) Handle(ctx context.Context, evt PriceCalculatedEvent) (*ProductDTO, error) {
	product, err := handler.productRepository.Get(ctx, evt.ProductId)

	if err != nil {
		return nil, err
	}

	product.ClearPricing()

	for index := range evt.PriceBrackets {
		bracket := evt.PriceBrackets[index]

		product.AddPrice(bracket.Quantity, bracket.Price)
	}

	handler.productRepository.Update(ctx, *product)

	return product.AsDto(), nil
}
