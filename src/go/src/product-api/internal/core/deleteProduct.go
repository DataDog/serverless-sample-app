package core

import "context"

type DeleteProductCommand struct {
	ProductId string `json:"productId"`
}

type DeleteProductCommandHandler struct {
	productRepository ProductRepository
	eventPublisher    ProductEventPublisher
}

func NewDeleteProductCommandHandler(productRepository ProductRepository, eventPublisher ProductEventPublisher) *DeleteProductCommandHandler {
	return &DeleteProductCommandHandler{
		productRepository: productRepository,
		eventPublisher:    eventPublisher,
	}
}

func (handler *DeleteProductCommandHandler) Handle(ctx context.Context, command DeleteProductCommand) {
	handler.productRepository.Delete(ctx, command.ProductId)

	handler.eventPublisher.PublishProductDeleted(ctx, ProductDeletedEvent{ProductId: command.ProductId})
}
