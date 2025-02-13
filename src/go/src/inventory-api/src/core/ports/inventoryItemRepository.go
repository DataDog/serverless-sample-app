package ports

import (
	"context"
	"inventory-api/src/core/domain"
)

type UpdateStockLevelCommand struct {
	ProductId  string `json:"productId"`
	StockLevel int    `json:"stockLevel"`
}

type GetStockLevelQuery struct {
	ProductId string `json:"productId"`
}

type InventoryItems interface {
	WithProductId(ctx context.Context, id string) (*domain.InventoryItem, error)
	Store(ctx context.Context, session *domain.InventoryItem) error
}

type InventoryService interface {
	GetStockLevel(ctx context.Context, query GetStockLevelQuery) (domain.InventoryItemDTO, error)
	UpdateStockLevel(ctx context.Context, stockLevel UpdateStockLevelCommand) (domain.InventoryItemDTO, error)
}
