//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

import (
	"context"

	"github.com/google/uuid"
)

type ProductRepository interface {
	Store(ctx context.Context, p Product) error
	Update(ctx context.Context, p Product) error
	Get(ctx context.Context, productId string) (*Product, error)
	Delete(ctx context.Context, productId string)
	List(ctx context.Context) ([]Product, error)
}

type Product struct {
	Id             string
	Name           string
	PreviousName   string
	Price          float32
	PreviousPrice  float32
	StockLevel     float32
	Updated        bool
	PriceBreakdown []ProductPrice
}

func NewProduct(name string, price float32) (*Product, error) {
	if len(name) <= 3 || price <= 0 {
		return nil, &InvalidProductDetailsError{ProductId: "", Name: name, Price: price}
	}

	return &Product{
		Id:             uuid.New().String(),
		Name:           name,
		Price:          price,
		PreviousName:   "",
		PreviousPrice:  -1,
		Updated:        false,
		PriceBreakdown: []ProductPrice{},
		StockLevel:     0,
	}, nil
}

func (p *Product) UpdateStockLevel(stockLevel float32) {
	p.StockLevel = stockLevel
}

func (p *Product) UpdateDetail(name string, price float32) error {
	if len(name) <= 3 || price <= 0 {
		return &InvalidProductDetailsError{ProductId: p.Id, Name: name, Price: price}
	}

	if p.Name != name {
		p.PreviousName = p.Name
		p.Name = name
		p.Updated = true
	}

	if p.Price != price {
		p.PreviousPrice = p.Price
		p.Price = price
		p.Updated = true
	}

	return nil
}

func (p *Product) ClearPricing() {
	p.PriceBreakdown = []ProductPrice{}
}

func (p *Product) AddPrice(quantity int, price float32) {
	p.PriceBreakdown = append(p.PriceBreakdown, ProductPrice{Quantity: quantity, Price: price})
}

func (p *Product) AsDto() *ProductDTO {
	return &ProductDTO{
		ProductId:      p.Id,
		Name:           p.Name,
		Price:          p.Price,
		PriceBreakdown: p.PriceBreakdown,
		StockLevel:     p.StockLevel,
	}
}

func (p *Product) AsListDto() *ProductListDTO {
	return &ProductListDTO{
		ProductId:  p.Id,
		Name:       p.Name,
		Price:      p.Price,
		StockLevel: p.StockLevel,
	}
}

type ProductPrice struct {
	Quantity int     `json:"quantity"`
	Price    float32 `json:"price"`
}

type ProductDTO struct {
	ProductId      string         `json:"productId"`
	Name           string         `json:"name"`
	Price          float32        `json:"price"`
	PriceBreakdown []ProductPrice `json:"pricingBrackets"`
	StockLevel     float32        `json:"stockLevel"`
}

type ProductListDTO struct {
	ProductId  string  `json:"productId"`
	Name       string  `json:"name"`
	Price      float32 `json:"price"`
	StockLevel float32 `json:"stockLevel"`
}
