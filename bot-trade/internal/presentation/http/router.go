package http

import (
	"time"

	"bot-trade/internal/presentation/http/handlers"
	"bot-trade/internal/presentation/http/middleware"

	"github.com/gin-gonic/gin"
)

// RouterConfig holds router configuration
type RouterConfig struct {
	GRPCServerAddr string
}

// NewRouter creates a new HTTP router with all routes configured
func NewRouter(
	bullishDivergenceHandler *handlers.BullishDivergenceHandler,
	bearishDivergenceHandler *handlers.BearishDivergenceHandler,
	cronHandler *handlers.CronHandler,
	config *RouterConfig,
) *gin.Engine {
	// Set Gin to release mode
	gin.SetMode(gin.ReleaseMode)

	router := gin.Default()

	// Add CORS middleware
	router.Use(middleware.CorsMiddleware())

	// Add logging middleware
	router.Use(middleware.LoggerWithFormatter())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":       "healthy",
			"service":      "High-Performance gRPC Trading Bot",
			"timestamp":    time.Now().Format(time.RFC3339),
			"grpc_server":  config.GRPCServerAddr,
			"optimization": "✅ Clean Architecture, DDD, KISS principles",
			"architecture": "Domain-driven with Clean Architecture layers",
		})
	})

	// API routes group with request validation middleware
	api := router.Group("/analyze")
	{
		// Divergence analysis endpoints
		api.GET("/:symbol/divergence/bullish", bullishDivergenceHandler.AnalyzeBullishDivergence)
		api.GET("/:symbol/divergence/bearish", bearishDivergenceHandler.AnalyzeBearishDivergence)
	}

	// Cron scheduler routes (simplified - auto-managed scheduler)
	cronGroup := router.Group("/cron")
	{
		cronGroup.GET("/status", cronHandler.GetStatus)
		cronGroup.POST("/symbols", cronHandler.UpdateSymbols)
	}

	return router
}
