// Package wire provides dependency injection and application wiring.
package wire

import (
	"net/http"

	"bot-trade/config"

	"go.uber.org/zap"
)

// App holds all initialized dependencies and manages application lifecycle.
type App struct {
	infra        *Infra
	services     *AppServices
	presentation *Presentation
}

// New creates and wires all application dependencies using layered constructors.
func New(cfg *config.InfraConfig) (*App, error) {
	// Infrastructure layer
	infra, err := NewInfra(cfg)
	if err != nil {
		return nil, err
	}

	// Application layer
	services, err := NewAppServices(cfg, infra)
	if err != nil {
		infra.Close()
		return nil, err
	}

	// Presentation layer
	presentation := NewPresentation(services)

	zap.L().Info("Application initialized successfully")

	return &App{
		infra:        infra,
		services:     services,
		presentation: presentation,
	}, nil
}

// Router returns the HTTP router.
func (a *App) Router() http.Handler {
	return a.presentation.Router
}

// StartSchedulers starts the cron schedulers.
func (a *App) StartSchedulers() {
	a.services.Scheduler.Start()
	zap.L().Info("Job scheduler started")
}

// StopSchedulers stops running schedulers.
func (a *App) StopSchedulers() {
	a.services.Scheduler.Stop()
	zap.L().Info("Job scheduler stopped")
}

// Close releases all application resources.
func (a *App) Close() {
	a.StopSchedulers()
	a.infra.Close()
}
