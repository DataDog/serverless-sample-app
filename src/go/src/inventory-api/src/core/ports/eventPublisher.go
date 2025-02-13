package ports

import (
	"context"
	"inventory-api/src/core/domain"
)

type EventPublisher interface {
	PublishStockLevelUpdatedEvent(ctx context.Context, e domain.StockLevelUpdatedEventV1)
}
