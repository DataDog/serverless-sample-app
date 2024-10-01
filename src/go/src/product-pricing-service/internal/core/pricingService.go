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
