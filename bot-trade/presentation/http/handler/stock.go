package handler

import (
	"errors"
	"net/http"

	"bot-trade/application/port/inbound"
	"bot-trade/domain/aggregate"
	"bot-trade/domain/aggregate/stockmetrics"

	"github.com/gin-gonic/gin"
)

// StockHandler handles stock metrics HTTP requests.
type StockHandler struct {
	stockMetrics inbound.StockMetricsManager
}

// NewStockHandler creates a new stock handler.
func NewStockHandler(stockMetrics inbound.StockMetricsManager) *StockHandler {
	return &StockHandler{stockMetrics: stockMetrics}
}

// RefreshStocks handles POST /stocks/refresh request.
// Fetches all stocks from HOSE, HNX, UPCOM, calculates metrics, and caches in RAM.
func (h *StockHandler) RefreshStocks(c *gin.Context) {
	result, err := h.stockMetrics.Refresh(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to refresh stock metrics",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Stock metrics refreshed successfully",
		"total_stocks":  result.TotalStocksAnalyzed,
		"stocks_ranked": result.StocksMatching,
		"calculated_at": result.CalculatedAt,
	})
}

// GetCacheInfo handles GET /stocks/cache-info request.
// Returns information about the current cache state.
func (h *StockHandler) GetCacheInfo(c *gin.Context) {
	cachedAt, totalStocks, ok := h.stockMetrics.GetCacheInfo()
	if !ok {
		c.JSON(http.StatusOK, gin.H{
			"cached":  false,
			"message": "Cache is empty. Call POST /stocks/refresh to populate.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cached":       true,
		"cached_at":    cachedAt,
		"total_stocks": totalStocks,
	})
}

// FilterStocks handles POST /stocks/filter request.
// Returns cached stock metrics filtered by advanced filter conditions with AND/OR logic.
//
// Available fields: rs_1m, rs_3m, rs_6m, rs_9m, rs_52w, volume_vs_sma, current_volume, volume_sma20
// Available operators: >=, <=, >, <, =
// Logic: "and" (all conditions must match) or "or" (any condition must match)
// Exchanges: optional filter by exchanges (HOSE, HNX, UPCOM)
func (h *StockHandler) FilterStocks(c *gin.Context) {
	var filterReq stockmetrics.FilterRequest
	if err := c.ShouldBindJSON(&filterReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
			"example": map[string]interface{}{
				"filters": []map[string]interface{}{
					{"field": "rs_52w", "op": ">=", "value": 80},
					{"field": "volume_vs_sma", "op": ">=", "value": 50},
				},
				"logic":     "and",
				"exchanges": []string{"HOSE", "HNX"},
			},
		})
		return
	}

	if err := filterReq.Validate(); err != nil {
		resp := gin.H{"error": err.Error()}
		// Add helpful hints for validation errors
		if _, ok := err.(*aggregate.ValidationError); ok {
			resp["valid_fields"] = stockmetrics.ValidFields()
			resp["valid_operators"] = stockmetrics.ValidOperators()
			resp["valid_exchanges"] = stockmetrics.ValidExchangesList()
		}
		c.JSON(http.StatusBadRequest, resp)
		return
	}

	// Execute filter
	result, err := h.stockMetrics.Filter(c.Request.Context(), &filterReq)
	if err != nil {
		if errors.Is(err, inbound.ErrCacheNotReady) {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   "Stock metrics cache not ready",
				"message": "Please call POST /stocks/refresh first to populate the cache",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to filter stocks",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}
