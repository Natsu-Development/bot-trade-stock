package handler

import (
	"errors"
	"net/http"

	"bot-trade/application/port/inbound"
	filtervo "bot-trade/domain/shared/valueobject/filter"
	marketvo "bot-trade/domain/shared/valueobject/market"
	"bot-trade/presentation/http/response"

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
		response.Error(c, http.StatusInternalServerError, "Failed to refresh stock metrics", err.Error())
		return
	}

	response.Success(c, http.StatusOK, gin.H{
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
		response.Success(c, http.StatusOK, gin.H{
			"cached":  false,
			"message": "Cache is empty. Call POST /stocks/refresh to populate.",
		})
		return
	}

	response.Success(c, http.StatusOK, gin.H{
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
	var filter filtervo.StockFilter
	if err := c.ShouldBindJSON(&filter); err != nil {
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

	// Execute filter (validation already performed during JSON unmarshaling)
	result, err := h.stockMetrics.Filter(c.Request.Context(), &filter)
	if err != nil {
		if errors.Is(err, inbound.ErrCacheNotReady) {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   "Stock metrics cache not ready",
				"message": "Please call POST /stocks/refresh first to populate the cache",
			})
			return
		}
		// Include helpful hints for validation errors from domain layer
		resp := gin.H{
			"error":           "Failed to filter stocks",
			"details":         err.Error(),
			"valid_fields":    filtervo.ValidFilterFields(),
			"valid_operators": filtervo.ValidFilterOperators(),
			"valid_exchanges": exchangesList(),
		}
		c.JSON(http.StatusBadRequest, resp)
		return
	}

	response.Success(c, http.StatusOK, result)
}

// exchangesList returns the list of valid exchange names.
func exchangesList() []string {
	exchanges := marketvo.AllExchanges()
	result := make([]string, len(exchanges))
	for i, e := range exchanges {
		result[i] = string(e)
	}
	return result
}
