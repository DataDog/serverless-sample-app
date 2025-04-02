//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

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
