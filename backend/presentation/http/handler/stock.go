package handler

import (
	"errors"
	"net/http"

	"backend/application/dto"
	"backend/application/port/inbound"
	filtervo "backend/domain/shared/valueobject/filter"
	marketvo "backend/domain/shared/valueobject/market"
	"backend/presentation/http/response"

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

// maxFilterBodyBytes bounds the POST /stocks/filter request body before decoding
// (defense in depth against oversized payloads; the condition cap in
// StockFilter.Validate is the second line).
const maxFilterBodyBytes = 256 << 10 // 256 KiB

// FilterStocks handles POST /stocks/filter request.
// Returns cached stock metrics filtered by a flat, two-level AND/OR/NOT filter.
//
// Body shape (flat, two-level): a top-level "match" ("and"|"or") over
// "conditions" and "groups" (each group is one level of conditions; no
// sub-groups), plus an optional outer-AND "exchanges" list. A condition is
// {field, op, value}; a group is {"match":"and"|"or","negate"?:bool,"conditions":[...]}.
// Signal (boolean) fields use op "=" with value true/false.
//
// Available fields: rs_1m, rs_3m, rs_6m, rs_9m, rs_52w, volume_vs_sma, current_volume, volume_sma20, signal fields
// Available operators: >=, <=, >, <, =
// Exchanges: optional filter by exchanges (HOSE, HNX, UPCOM)
func (h *StockHandler) FilterStocks(c *gin.Context) {
	// Cap the body before decoding so oversized/deeply-nested payloads are
	// rejected at read time rather than after allocating the whole tree.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFilterBodyBytes)

	var req dto.StockFilterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error":          "Request body too large",
				"details":        err.Error(),
				"max_bytes":      maxFilterBodyBytes,
				"max_conditions": filtervo.MaxFilterConditions,
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
			"example": map[string]interface{}{
				"match": "and",
				"conditions": []map[string]interface{}{
					{"field": "rs_52w", "op": ">=", "value": 70},
				},
				"groups": []map[string]interface{}{
					{"match": "or", "conditions": []map[string]interface{}{
						{"field": "has_breakout_confirmed", "op": "=", "value": true},
					}},
				},
				"exchanges": []string{"HOSE"},
			},
		})
		return
	}

	// Convert DTO to domain value object
	filter, err := req.ToDomain()
	if err != nil {
		// Include helpful hints for validation errors
		resp := gin.H{
			"error":           "Invalid filter parameters",
			"details":         err.Error(),
			"valid_fields":    filtervo.ValidFilterFields(),
			"valid_operators": filtervo.ValidFilterOperators(),
			"valid_exchanges": exchangesList(),
			"max_conditions":  filtervo.MaxFilterConditions,
		}
		c.JSON(http.StatusBadRequest, resp)
		return
	}

	// Execute filter
	result, err := h.stockMetrics.Filter(c.Request.Context(), filter)
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
