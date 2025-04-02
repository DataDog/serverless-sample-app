package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestListProductsQueryHandler_Handle(t *testing.T) {
	// Test cases
	tests := []struct {
		name           string
		query          ListProductsQuery
		setupMocks     func(*MockProductRepository)
		expectedResult []ProductListDTO
		expectedError  error
	}{
		{
			name:  "List products with results",
			query: ListProductsQuery{},
			setupMocks: func(repo *MockProductRepository) {
				// Create test products
				product1, _ := NewProduct("Product One", 10.99)
				product1.UpdateStockLevel(50)

				product2, _ := NewProduct("Product Two", 15.99)
				product2.UpdateStockLevel(25)

				product3, _ := NewProduct("Product Three", 20.99)
				product3.UpdateStockLevel(10)

				// List returns products
				repo.On("List", mock.Anything).Return([]Product{*product1, *product2, *product3}, nil)
			},
			expectedResult: func() []ProductListDTO {
				product1, _ := NewProduct("Product One", 10.99)
				product1.UpdateStockLevel(50)

				product2, _ := NewProduct("Product Two", 15.99)
				product2.UpdateStockLevel(25)

				product3, _ := NewProduct("Product Three", 20.99)
				product3.UpdateStockLevel(10)

				return []ProductListDTO{
					*product1.AsListDto(),
					*product2.AsListDto(),
					*product3.AsListDto(),
				}
			}(),
			expectedError: nil,
		},
		{
			name:  "List products with empty results",
			query: ListProductsQuery{},
			setupMocks: func(repo *MockProductRepository) {
				// List returns empty product list
				repo.On("List", mock.Anything).Return([]Product{}, nil)
			},
			expectedResult: []ProductListDTO{},
			expectedError:  nil,
		},
		{
			name:  "Repository error",
			query: ListProductsQuery{},
			setupMocks: func(repo *MockProductRepository) {
				// List returns error
				repo.On("List", mock.Anything).Return([]Product{}, &UnknownError{Detail: "DB connection error"})
			},
			expectedResult: []ProductListDTO{},
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
			handler := NewListProductsQueryHandler(repo)

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
