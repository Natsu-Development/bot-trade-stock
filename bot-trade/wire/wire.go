// Package wire provides dependency injection and application wiring.
package wire

import (
	"net/http"
	"time"

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

// ReloadCredentials reloads the SSI credentials from the env file.
// Called by the SIGHUP handler in cmd/server/main.go; non-fatal on error —
// the prior credential snapshot is preserved on parse failure.
func (a *App) ReloadCredentials() error {
	return a.infra.CredStore.Reload()
}

// CurrentCredentialMintedAt returns the MintedAt timestamp of the current SSI
// credential snapshot. Used by the SIGHUP handler to log reload events.
func (a *App) CurrentCredentialMintedAt() time.Time {
	return a.infra.CredStore.Current().MintedAt
}

// Close releases all application resources.
func (a *App) Close() {
	a.StopSchedulers()
	a.infra.Close()
}
