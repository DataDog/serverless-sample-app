package handlers

import (
	"github.com/gin-gonic/gin"
	"inventory-api/src/core/ports"

	"log/slog"
)

type InventoryHTTPHandler struct {
	inventoryService ports.InventoryService
}

func NewInventoryHTTPHandler(inventoryService ports.InventoryService) *InventoryHTTPHandler {
	return &InventoryHTTPHandler{
		inventoryService: inventoryService,
	}
}

func (hdl *InventoryHTTPHandler) Get(c *gin.Context) {
	inventoryItem, err := hdl.inventoryService.GetStockLevel(c.Request.Context(), ports.GetStockLevelQuery{
		ProductId: c.Param("id"),
	})
	if err != nil {
		slog.Error("failure retrieving data from inventoryItem service")
		c.AbortWithStatusJSON(500, gin.H{"message": err.Error()})
		return
	}

	c.JSON(200, inventoryItem)
}

func (hdl *InventoryHTTPHandler) Post(c *gin.Context) {
	var command ports.UpdateStockLevelCommand

	if err := c.BindJSON(&command); err != nil {
		slog.Error(err.Error())
		return
	}

	inventoryItem, err := hdl.inventoryService.UpdateStockLevel(c.Request.Context(), command)
	if err != nil {
		c.AbortWithStatusJSON(500, gin.H{"message": err.Error()})
		return
	}

	c.JSON(200, inventoryItem)
}
