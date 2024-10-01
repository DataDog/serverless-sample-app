package core

import "context"

type UpdateProductCommand struct {
	ProductId string  `json:"productId"`
	Name      string  `json:"name"`
	Price     float32 `json:"price"`
}

type UpdateProductCommandHandler struct {
	productRepository ProductRepository
	eventPublisher    ProductEventPublisher
}

func NewUpdateProductCommandHandler(productRepository ProductRepository, eventPublisher ProductEventPublisher) *UpdateProductCommandHandler {
	return &UpdateProductCommandHandler{
		productRepository: productRepository,
		eventPublisher:    eventPublisher,
	}
}

func (handler *UpdateProductCommandHandler) Handle(ctx context.Context, command UpdateProductCommand) (*ProductDTO, error) {
	product, err := handler.productRepository.Get(ctx, command.ProductId)

	if err != nil {
		return nil, err
	}

	err = product.UpdateDetail(command.Name, command.Price)

	if err != nil {
		return nil, err
	}

	if !product.Updated {
		return product.AsDto(), &UpdateNotRequiredError{}
	}

	err = handler.productRepository.Update(ctx, *product)

	if err != nil {
		return nil, err
	}

	handler.eventPublisher.PublishProductUpdated(ctx, ProductUpdatedEvent{ProductId: command.ProductId, New: ProductDetails{Name: product.Name, Price: product.Price}, Previous: ProductDetails{Name: product.PreviousName, Price: product.PreviousPrice}})

	return product.AsDto(), nil
}
