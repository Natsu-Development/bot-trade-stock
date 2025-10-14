package handlers

import (
	"net/http"

	"bot-trade/internal/application/services"

	"github.com/gin-gonic/gin"
)

// CronHandler handles cron scheduler HTTP requests
type CronHandler struct {
	bearishCronScheduler *services.BearishCronScheduler
	bullishCronScheduler *services.BullishCronScheduler
}

// NewCronHandler creates a new cron handler
func NewCronHandler(bearishCronScheduler *services.BearishCronScheduler, bullishCronScheduler *services.BullishCronScheduler) *CronHandler {
	return &CronHandler{
		bearishCronScheduler: bearishCronScheduler,
		bullishCronScheduler: bullishCronScheduler,
	}
}

// GetStatus returns the status of both cron schedulers
func (h *CronHandler) GetStatus(c *gin.Context) {
	status := map[string]interface{}{
		"bearish": map[string]interface{}{
			"running":      h.bearishCronScheduler.IsRunning(),
			"service":      "bearish-divergence-cron",
			"auto_managed": true,
		},
		"bullish": map[string]interface{}{
			"running":      h.bullishCronScheduler.IsRunning(),
			"service":      "bullish-divergence-cron",
			"auto_managed": true,
		},
		"timestamp": "now",
		"note":      "Schedulers are auto-managed and run based on environment configuration",
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"status":  status,
	})
}

// UpdateSymbols updates the predefined symbols for both schedulers
func (h *CronHandler) UpdateSymbols(c *gin.Context) {
	var request struct {
		Symbols []string `json:"symbols" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid request format: " + err.Error(),
		})
		return
	}

	if len(request.Symbols) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Symbols list cannot be empty",
		})
		return
	}

	// Update symbols for both schedulers
	h.bearishCronScheduler.UpdateSymbols(request.Symbols)
	h.bullishCronScheduler.UpdateSymbols(request.Symbols)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "📝 Symbols updated successfully for both bearish and bullish schedulers",
		"count":   len(request.Symbols),
		"symbols": request.Symbols,
	})
}
