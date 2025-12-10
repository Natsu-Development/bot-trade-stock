package http

import (
	"time"

	"bot-trade/presentation/http/handler"
	"bot-trade/presentation/http/middleware"

	"github.com/gin-gonic/gin"
)

// NewRouter creates a new HTTP router with all routes configured
func NewRouter(
	bullishDivergenceHandler *handler.BullishDivergenceHandler,
	bearishDivergenceHandler *handler.BearishDivergenceHandler,
) *gin.Engine {
	// Set Gin to release mode
	gin.SetMode(gin.ReleaseMode)

	router := gin.Default()

	// Add CORS middleware
	router.Use(middleware.CorsMiddleware())

	// Add logging middleware
	router.Use(middleware.LoggerWithFormatter())

	// Health check endpoint - simple and focused
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	// API routes group with request validation middleware
	api := router.Group("/analyze")
	{
		// Divergence analysis endpoints
		api.GET("/:symbol/divergence/bullish", bullishDivergenceHandler.AnalyzeBullishDivergence)
		api.GET("/:symbol/divergence/bearish", bearishDivergenceHandler.AnalyzeBearishDivergence)
	}

	return router
}
