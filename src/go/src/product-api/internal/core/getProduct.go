package core

import "context"

type GetProductQuery struct {
	ProductId string `json:"productId"`
}

type GetProductQueryHandler struct {
	productRepository ProductRepository
}

func NewGetProductQueryHandler(productRepository ProductRepository) *GetProductQueryHandler {
	return &GetProductQueryHandler{
		productRepository: productRepository,
	}
}

func (handler *GetProductQueryHandler) Handle(ctx context.Context, command GetProductQuery) (*ProductDTO, error) {
	product, err := handler.productRepository.Get(ctx, command.ProductId)

	if err != nil {
		return nil, err
	}

	return product.AsDto(), nil
}
