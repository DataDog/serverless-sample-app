package handlers

import (
	"github.com/gin-gonic/gin"
	"inventory-api/src/core/ports"
)

type HealthHTTPHandler struct {
	inventoryService ports.InventoryService
}

func NewHealthHTTPHandler() *HealthHTTPHandler {
	return &HealthHTTPHandler{}
}

func (hdl *HealthHTTPHandler) HealthCheck(c *gin.Context) {
	c.JSON(200, "{}")
}
