package handler

import (
	"errors"
	"net/http"

	"bot-trade/application/usecase"
	"bot-trade/domain/aggregate/stockmetrics"

	"github.com/gin-gonic/gin"
)

// StockHandler handles stock metrics HTTP requests.
type StockHandler struct {
	useCase *usecase.StockMetricsUseCase
}

// NewStockHandler creates a new stock handler.
func NewStockHandler(useCase *usecase.StockMetricsUseCase) *StockHandler {
	return &StockHandler{useCase: useCase}
}

// RefreshStocks handles POST /stocks/refresh request.
// Fetches all stocks from HOSE, HNX, UPCOM, calculates metrics, and caches in RAM.
func (h *StockHandler) RefreshStocks(c *gin.Context) {
	result, err := h.useCase.Refresh(c.Request.Context())
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
	cachedAt, totalStocks, ok := h.useCase.GetCacheInfo()
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
		if ve, ok := err.(*stockmetrics.FilterValidationError); ok {
			resp := gin.H{"error": err.Error()}
			switch ve.Type {
			case "field":
				resp["condition"] = ve.Index
				resp["field"] = ve.Value
				resp["valid_fields"] = stockmetrics.ValidFields()
			case "operator":
				resp["condition"] = ve.Index
				resp["operator"] = ve.Value
				resp["valid_ops"] = stockmetrics.ValidOperators()
			case "logic":
				resp["logic"] = ve.Value
				resp["valid_values"] = []string{"and", "or"}
			case "exchange":
				resp["exchange"] = ve.Value
				resp["valid_exchanges"] = stockmetrics.ValidExchangesList()
			}
			c.JSON(http.StatusBadRequest, resp)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	// Execute filter
	result, err := h.useCase.Filter(c.Request.Context(), &filterReq)
	if err != nil {
		if errors.Is(err, usecase.ErrCacheNotReady) {
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
