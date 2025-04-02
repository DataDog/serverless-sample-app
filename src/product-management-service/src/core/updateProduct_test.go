package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestUpdateProductCommandHandler_Handle(t *testing.T) {
	// Test cases
	tests := []struct {
		name           string
		command        UpdateProductCommand
		setupMocks     func(*MockProductRepository, *MockEventPublisher)
		expectedResult *ProductDTO
		expectedError  error
	}{
		{
			name: "Valid product update",
			command: UpdateProductCommand{
				ProductId: "TESTPRODUCT",
				Name:      "Updated Product",
				Price:     15.99,
			},
			setupMocks: func(repo *MockProductRepository, pub *MockEventPublisher) {
				// Create existing product for test
				existingProduct, _ := NewProduct("Test Product", 10.99)

				// Get returns the existing product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(existingProduct, nil)

				// The product should be updated
				repo.On("Update", mock.Anything, mock.MatchedBy(func(p Product) bool {
					return p.Id == "TESTPRODUCT" &&
						p.Name == "Updated Product" &&
						p.Price == 15.99 &&
						p.PreviousName == "Test Product" &&
						p.PreviousPrice == 10.99 &&
						p.Updated == true
				})).Return(nil)

				// Publish event
				pub.On("PublishProductUpdated", mock.Anything, mock.MatchedBy(func(evt ProductUpdatedEvent) bool {
					return evt.ProductId == "TESTPRODUCT" &&
						evt.New.Name == "Updated Product" &&
						evt.New.Price == 15.99 &&
						evt.Previous.Name == "Test Product" &&
						evt.Previous.Price == 10.99
				})).Return()
			},
			expectedResult: func() *ProductDTO {
				product, _ := NewProduct("Test Product", 10.99)
				product.UpdateDetail("Updated Product", 15.99)
				return product.AsDto()
			}(),
			expectedError: nil,
		},
		{
			name: "Product not found",
			command: UpdateProductCommand{
				ProductId: "NONEXISTENT",
				Name:      "Updated Product",
				Price:     15.99,
			},
			setupMocks: func(repo *MockProductRepository, pub *MockEventPublisher) {
				// Get returns an error
				repo.On("Get", mock.Anything, "NONEXISTENT").Return(nil, &ProductNotFoundError{ProductId: "NONEXISTENT"})

				// No update or publish calls expected
			},
			expectedResult: nil,
			expectedError:  &ProductNotFoundError{ProductId: "NONEXISTENT"},
		},
		{
			name: "Invalid product update - name too short",
			command: UpdateProductCommand{
				ProductId: "TESTPRODUCT",
				Name:      "Ab",
				Price:     15.99,
			},
			setupMocks: func(repo *MockProductRepository, pub *MockEventPublisher) {
				// Create existing product for test
				existingProduct, _ := NewProduct("Test Product", 10.99)

				// Get returns the existing product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(existingProduct, nil)

				// No update or publish calls expected
			},
			expectedResult: nil,
			expectedError: &InvalidProductDetailsError{
				ProductId: "TESTPRODUCT",
				Name:      "Ab",
				Price:     15.99,
			},
		},
		{
			name: "Invalid product update - negative price",
			command: UpdateProductCommand{
				ProductId: "TESTPRODUCT",
				Name:      "Updated Product",
				Price:     -5.0,
			},
			setupMocks: func(repo *MockProductRepository, pub *MockEventPublisher) {
				// Create existing product for test
				existingProduct, _ := NewProduct("Test Product", 10.99)

				// Get returns the existing product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(existingProduct, nil)

				// No update or publish calls expected
			},
			expectedResult: nil,
			expectedError: &InvalidProductDetailsError{
				ProductId: "TESTPRODUCT",
				Name:      "Updated Product",
				Price:     -5.0,
			},
		},
		{
			name: "No changes required",
			command: UpdateProductCommand{
				ProductId: "TESTPRODUCT",
				Name:      "Test Product",
				Price:     10.99,
			},
			setupMocks: func(repo *MockProductRepository, pub *MockEventPublisher) {
				// Create existing product for test
				existingProduct, _ := NewProduct("Test Product", 10.99)

				// Get returns the existing product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(existingProduct, nil)

				// No update or publish calls expected since no changes
			},
			expectedResult: func() *ProductDTO {
				product, _ := NewProduct("Test Product", 10.99)
				return product.AsDto()
			}(),
			expectedError: &UpdateNotRequiredError{},
		},
		{
			name: "Repository update error",
			command: UpdateProductCommand{
				ProductId: "TESTPRODUCT",
				Name:      "Updated Product",
				Price:     15.99,
			},
			setupMocks: func(repo *MockProductRepository, pub *MockEventPublisher) {
				// Create existing product for test
				existingProduct, _ := NewProduct("Test Product", 10.99)

				// Get returns the existing product
				repo.On("Get", mock.Anything, "TESTPRODUCT").Return(existingProduct, nil)

				// Update returns an error
				repo.On("Update", mock.Anything, mock.Anything).Return(&UnknownError{Detail: "DB error"})

				// No publish event call expected
			},
			expectedResult: nil,
			expectedError:  &UnknownError{Detail: "DB error"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mocks
			repo := new(MockProductRepository)
			pub := new(MockEventPublisher)

			if tt.setupMocks != nil {
				tt.setupMocks(repo, pub)
			}

			// Create handler
			handler := NewUpdateProductCommandHandler(repo, pub)

			// Execute
			result, err := handler.Handle(context.Background(), tt.command)

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
			pub.AssertExpectations(t)
		})
	}
}
