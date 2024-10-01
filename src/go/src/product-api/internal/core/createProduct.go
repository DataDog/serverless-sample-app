package core

import "context"

type CreateProductCommand struct {
	Name  string  `json:"name"`
	Price float32 `json:"price"`
}

type CreateProductCommandHandler struct {
	productRepository ProductRepository
	eventPublisher    ProductEventPublisher
}

func NewCreateProductCommandHandler(productRepository ProductRepository, eventPublisher ProductEventPublisher) *CreateProductCommandHandler {
	return &CreateProductCommandHandler{
		productRepository: productRepository,
		eventPublisher:    eventPublisher,
	}
}

func (handler *CreateProductCommandHandler) Handle(ctx context.Context, command CreateProductCommand) (*ProductDTO, error) {
	product, err := NewProduct(command.Name, command.Price)

	if err != nil {
		return nil, err
	}

	err = handler.productRepository.Store(ctx, *product)

	if err != nil {
		return nil, err
	}

	handler.eventPublisher.PublishProductCreated(ctx, ProductCreatedEvent{ProductId: product.Id, Name: product.Name, Price: product.Price})

	return product.AsDto(), nil
}
