package handlers

import (
	"net/http"

	"bot-trade/internal/application/usecases"
	"bot-trade/internal/presentation/http/utils"

	"github.com/gin-gonic/gin"
)

// BearishDivergenceHandler handles bearish divergence analysis HTTP requests
type BearishDivergenceHandler struct {
	analyzeBearishDivergenceUseCase *usecases.AnalyzeBearishDivergenceUseCase
}

// NewBearishDivergenceHandler creates a new bearish divergence handler
func NewBearishDivergenceHandler(analyzeBearishDivergenceUseCase *usecases.AnalyzeBearishDivergenceUseCase) *BearishDivergenceHandler {
	return &BearishDivergenceHandler{
		analyzeBearishDivergenceUseCase: analyzeBearishDivergenceUseCase,
	}
}

// AnalyzeBearishDivergence handles bearish divergence analysis requests
// Using helper function to validate request parameters and create AnalysisRequest DTO
func (h *BearishDivergenceHandler) AnalyzeBearishDivergence(c *gin.Context) {
	// Validate request parameters and create request object using helper function
	request, err := utils.ProcessRequest(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Execute use case
	response, err := h.analyzeBearishDivergenceUseCase.Execute(c.Request.Context(), request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Return appropriate status code
	c.JSON(http.StatusOK, response)
}
