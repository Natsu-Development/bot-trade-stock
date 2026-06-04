package wire

import (
	"net/http"

	"backend/config"
	presHTTP "backend/presentation/http"
	presHandler "backend/presentation/http/handler"

	"go.uber.org/zap"
)

// Presentation holds all presentation layer dependencies.
type Presentation struct {
	Router http.Handler
}

// NewPresentation initializes all presentation layer dependencies.
func NewPresentation(cfg *config.InfraConfig, app *AppServices) *Presentation {
	zap.L().Info("Initializing presentation layer")

	// Handlers
	configHandler := presHandler.NewConfigHandler(app.ConfigUC)
	stockHandler := presHandler.NewStockHandler(app.StockMetrics)
	analyzeHandler := presHandler.NewAnalyzeHandler(app.Analyzer, cfg.AnalysisWindowBars)

	// Router
	router := presHTTP.NewRouter(configHandler, stockHandler, analyzeHandler)

	return &Presentation{
		Router: router,
	}
}
