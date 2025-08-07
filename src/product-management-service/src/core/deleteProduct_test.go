package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
)

func TestDeleteProductCommandHandler_Handle(t *testing.T) {
	// Test cases
	tests := []struct {
		name       string
		command    DeleteProductCommand
		setupMocks func(*MockProductRepository, *MockOutboxRepository)
	}{
		{
			name: "Delete existing product",
			command: DeleteProductCommand{
				ProductId: "TESTPRODUCT",
			},
			setupMocks: func(repo *MockProductRepository, outbox *MockOutboxRepository) {
				// Delete product with outbox entry
				repo.On("DeleteProductWithOutboxEntry", mock.Anything, "TESTPRODUCT", mock.AnythingOfType("OutboxEntry")).Return(nil)
			},
		},
		{
			name: "Delete non-existent product",
			command: DeleteProductCommand{
				ProductId: "NONEXISTENT",
			},
			setupMocks: func(repo *MockProductRepository, outbox *MockOutboxRepository) {
				// Delete is still called even if product doesn't exist
				repo.On("DeleteProductWithOutboxEntry", mock.Anything, "NONEXISTENT", mock.AnythingOfType("OutboxEntry")).Return(nil)
			},
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
			handler := NewDeleteProductCommandHandler(repo, outbox)

			// Execute
			handler.Handle(context.Background(), tt.command)

			// Verify mock expectations
			repo.AssertExpectations(t)
			outbox.AssertExpectations(t)
		})
	}
}
