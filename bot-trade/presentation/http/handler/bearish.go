package handler

import (
	"net/http"

	"bot-trade/application/port"
	"bot-trade/domain/aggregate/market"
	"bot-trade/presentation/http/mapper"

	"github.com/gin-gonic/gin"
)

// BearishDivergenceHandler handles bearish divergence analysis HTTP requests.
type BearishDivergenceHandler struct {
	analyzer port.DivergenceAnalyzer
}

// NewBearishDivergenceHandler creates a new bearish divergence handler.
func NewBearishDivergenceHandler(analyzer port.DivergenceAnalyzer) *BearishDivergenceHandler {
	return &BearishDivergenceHandler{analyzer: analyzer}
}

// AnalyzeBearishDivergence handles bearish divergence analysis requests.
func (h *BearishDivergenceHandler) AnalyzeBearishDivergence(c *gin.Context) {
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
