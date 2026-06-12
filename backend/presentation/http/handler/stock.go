package handler

import (
	"errors"
	"net/http"

	"backend/application/dto"
	"backend/application/port/inbound"
	"backend/domain/config"
	filtervo "backend/domain/shared/valueobject/filter"
	marketvo "backend/domain/shared/valueobject/market"
	"backend/presentation/http/response"

	"github.com/gin-gonic/gin"
)

// StockHandler handles stock metrics HTTP requests.
type StockHandler struct {
	stockMetrics inbound.StockMetricsManager
}

// NewStockHandler creates a new stock handler. The handler is thin: it delegates all
// per-config orchestration (signal compute + filter) to the metrics use case and only
// maps the returned domain error to an HTTP status.
func NewStockHandler(stockMetrics inbound.StockMetricsManager) *StockHandler {
	return &StockHandler{stockMetrics: stockMetrics}
}

// requireConfigID reads the mandatory config_id query param, writing a 400 and
// returning ok=false when it is absent. After the no-system flip, every
// /stocks/* request MUST carry a real config_id (the cron's Refresh(ctx) is the
// only unguarded path — it never reaches the handler).
func requireConfigID(c *gin.Context) (string, bool) {
	id := c.Query("config_id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "config_id is required",
			"message": "Select a configuration (log in) before requesting stock metrics",
		})
		return "", false
	}
	return id, true
}

// respondCacheNotReady writes the standard 503 for an unpopulated stock-metrics
// cache (shared by the signals-resolution and filter paths).
func respondCacheNotReady(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, gin.H{
		"error":   "Stock metrics cache not ready",
		"message": "Stock data is warming up — the refresh job runs at startup and daily; please retry shortly",
	})
}

// respondMetricsErr maps a metrics use-case error to its HTTP status — a presentation
// concern only, no orchestration. Unknown config → 404, unpopulated cache → 503,
// anything else → 500.
func respondMetricsErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, config.ErrConfigNotFound):
		response.NotFound(c, "configuration")
	case errors.Is(err, inbound.ErrCacheNotReady):
		respondCacheNotReady(c)
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compute stock metrics", "details": err.Error()})
	}
}

// RecomputeStocks handles POST /stocks/recompute: it recomputes the caller's per-config
// caches from the cached snapshot bars (no sweep) — BOTH the screener signal flags and
// the watchlist alert trendlines. The provider fetch is the stock-refresh job's job; this
// endpoint never fetches. No snapshot → 503; otherwise 200 with the cache stamp + size.
func (h *StockHandler) RecomputeStocks(c *gin.Context) {
	configID, ok := requireConfigID(c)
	if !ok {
		return
	}

	// Recompute warms BOTH per-config caches and returns the cache stamp + ranked size
	// (it does not filter or project the snapshot).
	cachedAt, totalStocks, err := h.stockMetrics.Recompute(c.Request.Context(), configID)
	if err != nil {
		respondMetricsErr(c, err)
		return
	}

	response.Success(c, http.StatusOK, gin.H{
		"message":       "Per-config signals & alert levels recomputed from cache",
		"total_stocks":  totalStocks,
		"calculated_at": cachedAt,
	})
}

// GetCacheInfo handles GET /stocks/cache-info request.
// Returns information about the current cache state.
func (h *StockHandler) GetCacheInfo(c *gin.Context) {
	cachedAt, totalStocks, ok := h.stockMetrics.GetCacheInfo()
	if !ok {
		response.Success(c, http.StatusOK, gin.H{
			"cached":  false,
			"message": "Cache is empty; the refresh job populates it at startup and daily.",
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

	// config_id is required (no-system). The use case orchestrates: it resolves the
	// config's per-config signals and applies the filter; we only map errors here.
	configID, ok := requireConfigID(c)
	if !ok {
		return
	}

	result, err := h.stockMetrics.Filter(c.Request.Context(), filter, configID)
	if err != nil {
		respondMetricsErr(c, err)
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
