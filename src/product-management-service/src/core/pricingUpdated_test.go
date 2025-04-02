package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestPricingUpdatedEventHandler_Handle(t *testing.T) {
	// Test cases
	tests := []struct {
		name           string
		event          PriceCalculatedEvent
		setupMocks     func(*MockProductRepository)
		expectedResult *ProductDTO
		expectedError  error
	}{
		{
			name: "Update pricing brackets for existing product",
			event: PriceCalculatedEvent{
				ProductId: "TESTPRODUCT",
				PriceBrackets: []ProductPriceBreakdown{
					{Quantity: 10, Price: 9.99},
					{Quantity: 50, Price: 8.99},
					{Quantity: 100, Price: 7.99},
				},
			},
			setupMocks: func(repo *MockProductRepository) {
				// Create existing product for test
				product, _ := NewProduct("Test Product", 10.99)
				product.UpdateStockLevel(50)

				// Get returns the product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(product, nil)

				// Update is called with updated product
				repo.On("Update", mock.Anything, mock.MatchedBy(func(p Product) bool {
					if p.Id != "TESTPRODUCT" || len(p.PriceBreakdown) != 3 {
						return false
					}

					// Check price brackets
					return p.PriceBreakdown[0].Quantity == 10 && p.PriceBreakdown[0].Price == 9.99 &&
						p.PriceBreakdown[1].Quantity == 50 && p.PriceBreakdown[1].Price == 8.99 &&
						p.PriceBreakdown[2].Quantity == 100 && p.PriceBreakdown[2].Price == 7.99
				})).Return(nil)
			},
			expectedResult: func() *ProductDTO {
				product, _ := NewProduct("Test Product", 10.99)
				product.UpdateStockLevel(50)
				product.AddPrice(10, 9.99)
				product.AddPrice(50, 8.99)
				product.AddPrice(100, 7.99)
				return product.AsDto()
			}(),
			expectedError: nil,
		},
		{
			name: "Update pricing with empty brackets",
			event: PriceCalculatedEvent{
				ProductId:     "TESTPRODUCT",
				PriceBrackets: []ProductPriceBreakdown{},
			},
			setupMocks: func(repo *MockProductRepository) {
				// Create existing product with existing price brackets
				product, _ := NewProduct("Test Product", 10.99)
				product.AddPrice(10, 9.99)

				// Get returns the product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(product, nil)

				// Update is called with product that has price brackets cleared
				repo.On("Update", mock.Anything, mock.MatchedBy(func(p Product) bool {
					return p.Id == "TESTPRODUCT" && len(p.PriceBreakdown) == 0
				})).Return(nil)
			},
			expectedResult: func() *ProductDTO {
				product, _ := NewProduct("Test Product", 10.99)
				return product.AsDto()
			}(),
			expectedError: nil,
		},
		{
			name: "Product not found",
			event: PriceCalculatedEvent{
				ProductId: "NONEXISTENT",
				PriceBrackets: []ProductPriceBreakdown{
					{Quantity: 10, Price: 9.99},
				},
			},
			setupMocks: func(repo *MockProductRepository) {
				// Get returns not found error
				repo.On("Get", mock.Anything, "NONEXISTENT").Return(nil, &ProductNotFoundError{ProductId: "NONEXISTENT"})

				// Update should not be called
			},
			expectedResult: nil,
			expectedError:  &ProductNotFoundError{ProductId: "NONEXISTENT"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mocks
			repo := new(MockProductRepository)

			if tt.setupMocks != nil {
				tt.setupMocks(repo)
			}

			// Create handler
			handler := NewPricingUpdatedEventHandler(repo)

			// Execute
			result, err := handler.Handle(context.Background(), tt.event)

			// Verify results
			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				assert.NoError(t, err)
			}

			assert.Equal(t, tt.expectedResult, result)

			// Verify mock expectations
			repo.AssertExpectations(t)
		})
	}
}
