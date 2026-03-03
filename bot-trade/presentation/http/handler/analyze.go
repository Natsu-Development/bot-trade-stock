package handler

import (
	"errors"
	"net/http"

	"bot-trade/application/port/inbound"
	"bot-trade/domain/aggregate/config"
	"bot-trade/domain/aggregate/market"
	"bot-trade/presentation/http/mapper"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AnalyzeHandler handles unified analysis HTTP requests.
type AnalyzeHandler struct {
	analyzer inbound.Analyzer
	logger   *zap.Logger
}

// NewAnalyzeHandler creates a new unified analyze handler.
func NewAnalyzeHandler(analyzer inbound.Analyzer, logger *zap.Logger) *AnalyzeHandler {
	return &AnalyzeHandler{analyzer: analyzer, logger: logger}
}

// Analyze handles GET /analyze/:symbol request.
// Returns a unified response containing bullish divergence, bearish divergence,
// and trendline signals in a single API call.
//
// Query parameters:
//   - config_id (required): Configuration ID for analysis
//   - start_date, end_date, interval (optional): Date range and interval parameters
func (h *AnalyzeHandler) Analyze(c *gin.Context) {
	configID := c.Query("config_id")
	if configID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "config_id is required"})
		return
	}

	query, err := market.NewMarketDataQueryFromStrings(
		c.Param("symbol"),
		c.Query("start_date"),
		c.Query("end_date"),
		c.Query("interval"),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.analyzer.Execute(c.Request.Context(), query, configID)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration not found"})
			return
		}
		h.logger.Error("Analysis failed",
			zap.String("symbol", query.Symbol),
			zap.String("configID", configID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, mapper.CombinedAnalysisResultToJSON(result))
}
