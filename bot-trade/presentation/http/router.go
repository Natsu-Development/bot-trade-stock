package http

import (
	"time"

	"bot-trade/presentation/http/handler"
	"bot-trade/presentation/http/middleware"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// NewRouter creates a new HTTP router with all routes configured
func NewRouter(
	configHandler *handler.ConfigHandler,
	stockHandler *handler.StockHandler,
	analyzeHandler *handler.AnalyzeHandler,
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

	// Prometheus metrics endpoint - exposes Go runtime metrics (goroutines, GC, memory)
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Configuration CRUD endpoints
	router.POST("/config", configHandler.CreateConfig)
	router.GET("/config/:id", configHandler.GetConfig)
	router.PUT("/config/:id", configHandler.UpdateConfig)
	router.DELETE("/config/:id", configHandler.DeleteConfig)

	// Watchlist management endpoints
	router.POST("/config/:id/watchlist", configHandler.AddSymbolsToWatchlist)
	router.DELETE("/config/:id/watchlist", configHandler.RemoveSymbolsFromWatchlist)

	// Unified analysis endpoint - returns all analysis types in one call
	router.GET("/analyze/:symbol", analyzeHandler.Analyze)

	// Stock metrics endpoints
	// POST /stocks/refresh - Fetch all stocks, calculate metrics, cache in RAM
	// POST /stocks/filter - Advanced filtering with AND/OR logic
	// GET /stocks/cache-info - Get cache status
	router.POST("/stocks/refresh", stockHandler.RefreshStocks)
	router.POST("/stocks/filter", stockHandler.FilterStocks)
	router.GET("/stocks/cache-info", stockHandler.GetCacheInfo)

	return router
}
