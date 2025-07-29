package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock repositories and publishers
type MockProductRepository struct {
	mock.Mock
}

func (m *MockProductRepository) Store(ctx context.Context, p Product) error {
	args := m.Called(ctx, p)
	return args.Error(0)
}

func (m *MockProductRepository) Update(ctx context.Context, p Product) error {
	args := m.Called(ctx, p)
	return args.Error(0)
}

func (m *MockProductRepository) Get(ctx context.Context, productId string) (*Product, error) {
	args := m.Called(ctx, productId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Product), args.Error(1)
}

func (m *MockProductRepository) Delete(ctx context.Context, productId string) {
	m.Called(ctx, productId)
}

func (m *MockProductRepository) List(ctx context.Context) ([]Product, error) {
	args := m.Called(ctx)
	return args.Get(0).([]Product), args.Error(1)
}

func (m *MockProductRepository) ApplyMigrations(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockProductRepository) StoreProductWithOutboxEntry(ctx context.Context, product Product, outboxEntry OutboxEntry) error {
	args := m.Called(ctx, product, outboxEntry)
	return args.Error(0)
}

func (m *MockProductRepository) UpdateProductWithOutboxEntry(ctx context.Context, product Product, outboxEntry OutboxEntry) error {
	args := m.Called(ctx, product, outboxEntry)
	return args.Error(0)
}

func (m *MockProductRepository) DeleteProductWithOutboxEntry(ctx context.Context, productId string, outboxEntry OutboxEntry) error {
	args := m.Called(ctx, productId, outboxEntry)
	return args.Error(0)
}

type MockEventPublisher struct {
	mock.Mock
}

func (m *MockEventPublisher) PublishProductCreated(ctx context.Context, evt ProductCreatedEvent) {
	m.Called(ctx, evt)
}

func (m *MockEventPublisher) PublishProductUpdated(ctx context.Context, evt ProductUpdatedEvent) {
	m.Called(ctx, evt)
}

func (m *MockEventPublisher) PublishProductDeleted(ctx context.Context, evt ProductDeletedEvent) {
	m.Called(ctx, evt)
}

type MockOutboxRepository struct {
	mock.Mock
}

func (m *MockOutboxRepository) StoreOutboxEntry(ctx context.Context, entry OutboxEntry) error {
	args := m.Called(ctx, entry)
	return args.Error(0)
}

func (m *MockOutboxRepository) GetUnprocessedEntries(ctx context.Context) ([]OutboxEntry, error) {
	args := m.Called(ctx)
	return args.Get(0).([]OutboxEntry), args.Error(1)
}

func (m *MockOutboxRepository) MarkAsProcessed(ctx context.Context, entryId string) error {
	args := m.Called(ctx, entryId)
	return args.Error(0)
}

func TestCreateProductCommandHandler_Handle(t *testing.T) {
	// Test cases
	tests := []struct {
		name           string
		command        CreateProductCommand
		setupMocks     func(*MockProductRepository, *MockOutboxRepository)
		expectedResult *ProductDTO
		expectedError  error
	}{
		{
			name: "Valid product creation",
			command: CreateProductCommand{
				Name:  "Test Product",
				Price: 10.99,
			},
			setupMocks: func(repo *MockProductRepository, outbox *MockOutboxRepository) {
				expectedProduct, _ := NewProduct("Test Product", 10.99)

				// Product doesn't exist yet
				repo.On("Get", mock.Anything, expectedProduct.Id).Return(nil, nil)

				// Store the product with outbox entry
				repo.On("StoreProductWithOutboxEntry", mock.Anything, *expectedProduct, mock.AnythingOfType("OutboxEntry")).Return(nil)
			},
			expectedResult: func() *ProductDTO {
				product, _ := NewProduct("Test Product", 10.99)
				return product.AsDto()
			}(),
			expectedError: nil,
		},
		{
			name: "Invalid product - name too short",
			command: CreateProductCommand{
				Name:  "Ab",
				Price: 10.99,
			},
			setupMocks: func(repo *MockProductRepository, outbox *MockOutboxRepository) {
				// No repository or publisher calls expected
			},
			expectedResult: nil,
			expectedError: &InvalidProductDetailsError{
				ProductId: "",
				Name:      "Ab",
				Price:     10.99,
			},
		},
		{
			name: "Invalid product - negative price",
			command: CreateProductCommand{
				Name:  "Valid Name",
				Price: -5.0,
			},
			setupMocks: func(repo *MockProductRepository, outbox *MockOutboxRepository) {
				// No repository or publisher calls expected
			},
			expectedResult: nil,
			expectedError: &InvalidProductDetailsError{
				ProductId: "",
				Name:      "Valid Name",
				Price:     -5.0,
			},
		},
		{
			name: "Product already exists",
			command: CreateProductCommand{
				Name:  "Existing Product",
				Price: 15.99,
			},
			setupMocks: func(repo *MockProductRepository, outbox *MockOutboxRepository) {
				existingProduct, _ := NewProduct("Existing Product", 15.99)

				// Product already exists
				repo.On("Get", mock.Anything, existingProduct.Id).Return(existingProduct, nil)

				// No store or publish calls expected
			},
			expectedResult: func() *ProductDTO {
				product, _ := NewProduct("Existing Product", 15.99)
				return product.AsDto()
			}(),
			expectedError: nil,
		},
		{
			name: "Repository storage error",
			command: CreateProductCommand{
				Name:  "Error Product",
				Price: 20.00,
			},
			setupMocks: func(repo *MockProductRepository, outbox *MockOutboxRepository) {
				expectedProduct, _ := NewProduct("Error Product", 20.00)

				// Product doesn't exist yet
				repo.On("Get", mock.Anything, expectedProduct.Id).Return(nil, nil)

				// Store returns an error
				repo.On("Store", mock.Anything, *expectedProduct).Return(&UnknownError{Detail: "DB error"})

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
			outbox := new(MockOutboxRepository)

			if tt.setupMocks != nil {
				tt.setupMocks(repo, outbox)
			}

			// Create handler
			handler := NewCreateProductCommandHandler(repo, outbox)

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
