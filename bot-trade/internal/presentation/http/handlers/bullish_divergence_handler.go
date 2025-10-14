package handlers

import (
	"net/http"

	"bot-trade/internal/application/usecases"
	"bot-trade/internal/presentation/http/utils"

	"github.com/gin-gonic/gin"
)

// BullishDivergenceHandler handles bullish divergence analysis HTTP requests
type BullishDivergenceHandler struct {
	analyzeBullishDivergenceUseCase *usecases.AnalyzeBullishDivergenceUseCase
}

// NewBullishDivergenceHandler creates a new bullish divergence handler
func NewBullishDivergenceHandler(analyzeBullishDivergenceUseCase *usecases.AnalyzeBullishDivergenceUseCase) *BullishDivergenceHandler {
	return &BullishDivergenceHandler{
		analyzeBullishDivergenceUseCase: analyzeBullishDivergenceUseCase,
	}
}

// AnalyzeBullishDivergence handles bullish divergence analysis requests
// Using helper function to validate request parameters and create AnalysisRequest DTO
func (h *BullishDivergenceHandler) AnalyzeBullishDivergence(c *gin.Context) {
	// Validate request parameters and create request object using helper function
	request, err := utils.ProcessRequest(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Execute use case
	response, err := h.analyzeBullishDivergenceUseCase.Execute(c.Request.Context(), request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Return appropriate status code
	c.JSON(http.StatusOK, response)
}
