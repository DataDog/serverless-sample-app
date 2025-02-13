package services

import (
	"context"
	"inventory-api/src/core/domain"
	"inventory-api/src/core/ports"
)

type InventoryService struct {
	inventoryItems ports.InventoryItems
	eventPublisher ports.EventPublisher
}

func NewInventoryService(inventoryItems ports.InventoryItems, eventPublisher ports.EventPublisher) *InventoryService {
	return &InventoryService{
		inventoryItems: inventoryItems,
		eventPublisher: eventPublisher,
	}
}

func (s *InventoryService) GetStockLevel(ctx context.Context, query ports.GetStockLevelQuery) (domain.InventoryItemDTO, error) {
	var item, err = s.inventoryItems.WithProductId(ctx, query.ProductId)

	if err != nil {
		return domain.InventoryItemDTO{}, err
	}

	return item.AsDto(), nil
}

func (s *InventoryService) UpdateStockLevel(ctx context.Context, stockLevel ports.UpdateStockLevelCommand) (domain.InventoryItemDTO, error) {
	var item, err = s.inventoryItems.WithProductId(ctx, stockLevel.ProductId)

	if err != nil {
		return domain.InventoryItemDTO{}, err
	}

	var previousStockLevel = item.StockLevel

	item.StockLevel = stockLevel.StockLevel

	if err := s.inventoryItems.Store(ctx, item); err != nil {
		return domain.InventoryItemDTO{}, err
	}

	s.eventPublisher.PublishStockLevelUpdatedEvent(ctx, domain.StockLevelUpdatedEventV1{
		ProductId:          item.ProductId,
		PreviousStockLevel: previousStockLevel,
		NewStockLevel:      item.StockLevel,
	})

	return item.AsDto(), nil
}
