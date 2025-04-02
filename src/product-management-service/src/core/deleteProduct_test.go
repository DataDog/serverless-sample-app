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
		setupMocks func(*MockProductRepository, *MockEventPublisher)
	}{
		{
			name: "Delete existing product",
			command: DeleteProductCommand{
				ProductId: "TESTPRODUCT",
			},
			setupMocks: func(repo *MockProductRepository, pub *MockEventPublisher) {
				// Delete is called
				repo.On("Delete", mock.Anything, "TESTPRODUCT").Return()

				// Publish event
				pub.On("PublishProductDeleted", mock.Anything, ProductDeletedEvent{
					ProductId: "TESTPRODUCT",
				}).Return()
			},
		},
		{
			name: "Delete non-existent product",
			command: DeleteProductCommand{
				ProductId: "NONEXISTENT",
			},
			setupMocks: func(repo *MockProductRepository, pub *MockEventPublisher) {
				// Delete is still called even if product doesn't exist
				repo.On("Delete", mock.Anything, "NONEXISTENT").Return()

				// Publish event is still called
				pub.On("PublishProductDeleted", mock.Anything, ProductDeletedEvent{
					ProductId: "NONEXISTENT",
				}).Return()
			},
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
			handler := NewDeleteProductCommandHandler(repo, pub)

			// Execute
			handler.Handle(context.Background(), tt.command)

			// Verify mock expectations
			repo.AssertExpectations(t)
			pub.AssertExpectations(t)
		})
	}
}
