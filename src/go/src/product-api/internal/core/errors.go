package core

import "fmt"

type UnknownError struct{ Detail string }

func (e *UnknownError) Error() string {
	return fmt.Sprintf("Unknown error: %s", e.Detail)
}

type UpdateNotRequiredError struct{}

func (e *UpdateNotRequiredError) Error() string {
	return "Update not required"
}

type ProductNotFoundError struct {
	ProductId string
}

func (e *ProductNotFoundError) Error() string {
	return "Product not found"
}

type InvalidProductDetailsError struct {
	ProductId string
	Name      string
	Price     float32
}

func (e *InvalidProductDetailsError) Error() string {
	return fmt.Sprintf("Product details for %s are invalid. Name: '%s'. Price: '%f'", e.ProductId, e.Name, e.Price)
}
