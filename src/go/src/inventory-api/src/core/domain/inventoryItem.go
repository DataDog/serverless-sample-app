package domain

type InventoryItem struct {
	ProductId  string `json:"productId"`
	StockLevel int    `json:"stockLevel"`
}

func (w *InventoryItem) AsDto() InventoryItemDTO {
	return InventoryItemDTO{
		ProductId:  w.ProductId,
		StockLevel: w.StockLevel,
	}
}

type InventoryItemDTO struct {
	ProductId  string `json:"productId"`
	StockLevel int    `json:"stockLevel"`
}

type StockLevelUpdatedEventV1 struct {
	ProductId          string `json:"productId"`
	PreviousStockLevel int    `json:"previousStockLevel"`
	NewStockLevel      int    `json:"newStockLevel"`
}
