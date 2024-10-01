package core

import "context"

type ListProductsQuery struct {
}

type ListProductsQueryHandler struct {
	productRepository ProductRepository
}

func NewListProductsQueryHandler(productRepository ProductRepository) *ListProductsQueryHandler {
	return &ListProductsQueryHandler{
		productRepository: productRepository,
	}
}

func (handler *ListProductsQueryHandler) Handle(ctx context.Context, command ListProductsQuery) ([]ProductListDTO, error) {
	products, err := handler.productRepository.List(ctx)

	listResponse := []ProductListDTO{}

	if err != nil {
		return listResponse, err
	}

	for _, element := range products {
		listResponse = append(listResponse, *element.AsListDto())
	}

	return listResponse, nil
}
