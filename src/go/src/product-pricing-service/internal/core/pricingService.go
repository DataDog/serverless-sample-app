//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package core

type PricingResult struct {
	quantityToOrder int
	price           float32
}

type PricingService struct{}

func (pricingService *PricingService) calculatePricesFor(price float32) ([]PricingResult, error) {
	if price <= 0 {
		return []PricingResult{}, &PriceLessThanZeroError{}
	}

	pricingResults := []PricingResult{
		{
			quantityToOrder: 5,
			price:           price * 0.95,
		},
		{
			quantityToOrder: 10,
			price:           price * 0.9,
		},
		{
			quantityToOrder: 25,
			price:           price * 0.8,
		},
		{
			quantityToOrder: 50,
			price:           price * 0.75,
		},
		{
			quantityToOrder: 100,
			price:           price * 0.7,
		},
	}

	return pricingResults, nil
}
