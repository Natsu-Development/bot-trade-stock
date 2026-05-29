package registry

import (
	"time"

	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	appService "bot-trade/application/service"
	appPrep "bot-trade/application/usecase/analyze/prep"
	appRsi "bot-trade/application/usecase/analyze/rsi"
	appTrendline "bot-trade/application/usecase/analyze/trendline"
	"bot-trade/config"
	alertservice "bot-trade/domain/config/service"
)

// Global registry instance
var globalRegistry = NewJobRegistry()

// JobDependencies contains all dependencies needed to create jobs.
type JobDependencies struct {
	// Preparer for jobs to prepare data before calling use cases
	Preparer *appPrep.Preparer

	// Specialized use cases for jobs (pure analysis, no I/O)
	BullishRSIUC *appRsi.BullishRSIUseCase
	BearishRSIUC *appRsi.BearishRSIUseCase
	BreakoutUC   *appTrendline.BreakoutUseCase
	BreakdownUC  *appTrendline.BreakdownUseCase

	// Stock metrics manager
	StockMetricsManager inbound.StockMetricsManager

	// Shared dependencies
	Notifier          outbound.Notifier
	ConfigRepo        outbound.ConfigRepository
	QuoteProvider     outbound.QuoteProvider
	AlertEvaluator    *alertservice.AlertEvaluator
	ConditionDisabler *appService.ConditionDisabler
	Config            *config.InfraConfig

	// MarketTimezone is the HoSE-local timezone (Asia/Ho_Chi_Minh by default,
	// loaded once at startup from CRON_TIMEZONE in wire/app.go).
	// Job factories that gate on HoSE trading sessions (currently only
	// StockAlertJob) read it via this injected field rather than calling
	// time.LoadLocation themselves, keeping the binary's view of "Vietnam
	// time" single-sourced.
	MarketTimezone *time.Location
}

// JobFactory creates one or more job instances from dependencies.
// Returns a slice because one factory can create multiple jobs (e.g., per interval).
type JobFactory func(deps JobDependencies) ([]inbound.Job, error)

// JobRegistry stores job factories for later instantiation.
type JobRegistry struct {
	factories map[string]JobFactory
}

// NewJobRegistry creates a new empty registry.
func NewJobRegistry() *JobRegistry {
	return &JobRegistry{
		factories: make(map[string]JobFactory),
	}
}

// RegisterFactory adds a job factory to the global registry.
// Called from init() functions in job files.
func RegisterFactory(name string, factory JobFactory) {
	globalRegistry.RegisterFactory(name, factory)
}

// RegisterFactory adds a job factory to this registry.
func (r *JobRegistry) RegisterFactory(name string, factory JobFactory) {
	r.factories[name] = factory
}

// AllFactories returns all registered factories.
func (r *JobRegistry) AllFactories() map[string]JobFactory {
	return r.factories
}

// GlobalRegistry returns the global registry instance.
func GlobalRegistry() *JobRegistry {
	return globalRegistry
}
