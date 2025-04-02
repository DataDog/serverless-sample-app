package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestGetProductQueryHandler_Handle(t *testing.T) {
	// Test cases
	tests := []struct {
		name           string
		query          GetProductQuery
		setupMocks     func(*MockProductRepository)
		expectedResult *ProductDTO
		expectedError  error
	}{
		{
			name: "Get existing product",
			query: GetProductQuery{
				ProductId: "TESTPRODUCT",
			},
			setupMocks: func(repo *MockProductRepository) {
				// Create product for test
				product, _ := NewProduct("Test Product", 10.99)
				product.UpdateStockLevel(50)

				// Get returns the product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(product, nil)
			},
			expectedResult: func() *ProductDTO {
				product, _ := NewProduct("Test Product", 10.99)
				product.UpdateStockLevel(50)
				return product.AsDto()
			}(),
			expectedError: nil,
		},
		{
			name: "Product not found",
			query: GetProductQuery{
				ProductId: "NONEXISTENT",
			},
			setupMocks: func(repo *MockProductRepository) {
				// Get returns not found error
				repo.On("Get", mock.Anything, "NONEXISTENT").Return(nil, &ProductNotFoundError{ProductId: "NONEXISTENT"})
			},
			expectedResult: nil,
			expectedError:  &ProductNotFoundError{ProductId: "NONEXISTENT"},
		},
		{
			name: "Repository error",
			query: GetProductQuery{
				ProductId: "ERRORPRODUCT",
			},
			setupMocks: func(repo *MockProductRepository) {
				// Get returns a general error
				repo.On("Get", mock.Anything, "ERRORPRODUCT").Return(nil, &UnknownError{Detail: "DB connection error"})
			},
			expectedResult: nil,
			expectedError:  &UnknownError{Detail: "DB connection error"},
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
			handler := NewGetProductQueryHandler(repo)

			// Execute
			result, err := handler.Handle(context.Background(), tt.query)

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
