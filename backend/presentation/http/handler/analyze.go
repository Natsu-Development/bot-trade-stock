package handler

import (
	"errors"
	"net/http"

	"backend/application/port/inbound"
	"backend/domain/config"
	marketvo "backend/domain/shared/valueobject/market"
	"backend/presentation/http/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AnalyzeHandler handles unified analysis HTTP requests.
type AnalyzeHandler struct {
	analyzer   inbound.Analyzer
	windowBars int
}

// NewAnalyzeHandler creates a new unified analyze handler.
// windowBars is the operator-set bar count (ANALYSIS_WINDOW_BARS), interval-scaled
// into the fetch span per request.
func NewAnalyzeHandler(analyzer inbound.Analyzer, windowBars int) *AnalyzeHandler {
	return &AnalyzeHandler{
		analyzer:   analyzer,
		windowBars: windowBars,
	}
}

// Analyze handles GET /analyze/:symbol request.
// Returns a unified response containing bullish divergence, bearish divergence,
// and trendline signals in a single API call.
//
// Query parameters:
//   - config_id (required): Configuration ID for analysis
//   - end_date (optional): End date for analysis (defaults to today)
//   - interval (optional): Data interval (defaults to 1D)
//
// startDate is automatically calculated as (end_date - the interval-scaled
// fetch span for the operator-set window bar count).
func (h *AnalyzeHandler) Analyze(c *gin.Context) {
	configID := c.Query("config_id")
	if configID == "" {
		response.BadRequest(c, "config_id is required")
		return
	}

	// Scale the operator-set window bar count by interval cadence so
	// weekly/monthly fetches return enough bars for the RSI/pivot/divergence
	// pipeline.
	intervalStr := c.DefaultQuery("interval", "1D")
	interval, err := marketvo.NewInterval(intervalStr)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	span := marketvo.FetchSpanForBars(interval, h.windowBars)

	// endDate defaults to today, startDate is calculated from the fetch span.
	query, err := marketvo.NewMarketDataQueryFromStrings(
		c.Param("symbol"),
		c.Query("end_date"),
		intervalStr,
		span,
	)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// Execute analysis use case - returns DTO ready for JSON marshaling
	result, err := h.analyzer.Execute(c.Request.Context(), query, configID)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			response.NotFound(c, "configuration")
			return
		}
		zap.L().Error("Analysis failed",
			zap.String("symbol", string(query.Symbol)),
			zap.String("configID", configID),
			zap.Error(err),
		)
		response.InternalError(c, "Internal server error")
		return
	}

	// Return result directly - DTO has JSON tags for API marshaling
	response.Success(c, http.StatusOK, result)
}
