package handler

import (
	"errors"
	"net/http"

	"bot-trade/application/port/inbound"
	"bot-trade/domain/config"
	marketvo "bot-trade/domain/shared/valueobject/market"
	"bot-trade/presentation/http/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AnalyzeHandler handles unified analysis HTTP requests.
type AnalyzeHandler struct {
	analyzer inbound.Analyzer
}

// NewAnalyzeHandler creates a new unified analyze handler.
func NewAnalyzeHandler(analyzer inbound.Analyzer) *AnalyzeHandler {
	return &AnalyzeHandler{
		analyzer: analyzer,
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
// startDate is automatically calculated as (end_date - config.LookbackDay)
func (h *AnalyzeHandler) Analyze(c *gin.Context) {
	configID := c.Query("config_id")
	if configID == "" {
		response.BadRequest(c, "config_id is required")
		return
	}

	// Fetch config first to get LookbackDay for startDate calculation
	cfg, err := h.analyzer.GetConfig(c.Request.Context(), configID)
	if err != nil {
		response.NotFound(c, "configuration")
		return
	}

	// endDate defaults to today, startDate is calculated from LookbackDay
	query, err := marketvo.NewMarketDataQueryFromStrings(
		c.Param("symbol"),
		c.Query("end_date"),
		c.DefaultQuery("interval", "1D"),
		cfg.LookbackDay,
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
