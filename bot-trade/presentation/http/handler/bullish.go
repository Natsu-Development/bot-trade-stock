package handler

import (
	"net/http"

	"bot-trade/application/port"
	"bot-trade/domain/aggregate/market"
	"bot-trade/presentation/http/mapper"

	"github.com/gin-gonic/gin"
)

// BullishDivergenceHandler handles bullish divergence analysis HTTP requests.
type BullishDivergenceHandler struct {
	analyzer port.DivergenceAnalyzer
}

// NewBullishDivergenceHandler creates a new bullish divergence handler.
func NewBullishDivergenceHandler(analyzer port.DivergenceAnalyzer) *BullishDivergenceHandler {
	return &BullishDivergenceHandler{analyzer: analyzer}
}

// AnalyzeBullishDivergence handles bullish divergence analysis requests.
func (h *BullishDivergenceHandler) AnalyzeBullishDivergence(c *gin.Context) {
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

	result, err := h.analyzer.Execute(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, mapper.AnalysisResultToJSON(result))
}
