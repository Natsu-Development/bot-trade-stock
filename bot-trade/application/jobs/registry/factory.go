package registry

import (
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	appPrep "bot-trade/application/usecase/analyze/prep"
	appRsi "bot-trade/application/usecase/analyze/rsi"
	appTrendline "bot-trade/application/usecase/analyze/trendline"
	"bot-trade/config"

	"go.uber.org/zap"
)

// Global registry instance
var globalRegistry = NewJobRegistry()

// JobDependencies contains all dependencies needed to create jobs.
type JobDependencies struct {
	// Legacy analyzer for backward compatibility (used by API)
	Analyzer inbound.Analyzer

	// Preparer for jobs to prepare data before calling use cases
	Preparer *appPrep.Preparer

	// Specialized use cases for jobs (pure analysis, no I/O)
	BullishRSIUC *appRsi.BullishRSIUseCase
	BearishRSIUC *appRsi.BearishRSIUseCase

	// Trendline use cases
	BreakoutUC  *appTrendline.BreakoutUseCase
	BreakdownUC *appTrendline.BreakdownUseCase

	// Stock metrics manager
	StockMetricsManager inbound.StockMetricsManager

	// Shared dependencies
	Notifier   outbound.Notifier
	ConfigRepo outbound.ConfigRepository
	Logger     *zap.Logger
	Config     *config.InfraConfig
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
