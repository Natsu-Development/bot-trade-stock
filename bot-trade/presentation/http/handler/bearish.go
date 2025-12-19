package handler

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"

	"bot-trade/application/port"
	"bot-trade/domain/aggregate/config"
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
	configID := c.Query("config_id")
	if configID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "config_id is required"})
		return
	}

	fmt.Println("start_date", c.Query("start_date"), "type", reflect.TypeOf(c.Query("start_date")))

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, mapper.AnalysisResultToJSON(result))
}
