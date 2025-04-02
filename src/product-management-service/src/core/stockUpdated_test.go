package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestProductStockUpdatedEventHandler_Handle(t *testing.T) {
	// Test cases
	tests := []struct {
		name           string
		event          StockUpdatedEvent
		setupMocks     func(*MockProductRepository)
		expectedResult *ProductDTO
		expectedError  error
	}{
		{
			name: "Update stock level for existing product",
			event: StockUpdatedEvent{
				ProductId:  "TESTPRODUCT",
				StockLevel: 75.5,
			},
			setupMocks: func(repo *MockProductRepository) {
				// Create existing product for test
				product, _ := NewProduct("Test Product", 10.99)
				product.UpdateStockLevel(25.0)

				// Get returns the product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(product, nil)

				// Update is called with updated product
				repo.On("Update", mock.Anything, mock.MatchedBy(func(p Product) bool {
					return p.Id == "TESTPRODUCT" && p.StockLevel == 75.5
				})).Return(nil)
			},
			expectedResult: func() *ProductDTO {
				product, _ := NewProduct("Test Product", 10.99)
				product.UpdateStockLevel(75.5)
				return product.AsDto()
			}(),
			expectedError: nil,
		},
		{
			name: "Update stock level to zero",
			event: StockUpdatedEvent{
				ProductId:  "TESTPRODUCT",
				StockLevel: 0.0,
			},
			setupMocks: func(repo *MockProductRepository) {
				// Create existing product for test
				product, _ := NewProduct("Test Product", 10.99)
				product.UpdateStockLevel(25.0)

				// Get returns the product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(product, nil)

				// Update is called with updated product
				repo.On("Update", mock.Anything, mock.MatchedBy(func(p Product) bool {
					return p.Id == "TESTPRODUCT" && p.StockLevel == 0.0
				})).Return(nil)
			},
			expectedResult: func() *ProductDTO {
				product, _ := NewProduct("Test Product", 10.99)
				product.UpdateStockLevel(0.0)
				return product.AsDto()
			}(),
			expectedError: nil,
		},
		{
			name: "Product not found",
			event: StockUpdatedEvent{
				ProductId:  "NONEXISTENT",
				StockLevel: 50.0,
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
			handler := NewProductStockUpdatedEventHandler(repo)

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
