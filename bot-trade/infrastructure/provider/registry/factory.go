package registry

import (
	"net/http"
	"sync"

	"bot-trade/infrastructure/provider/contract"
)

// ProviderFactory creates a Provider instance.
type ProviderFactory func(client *http.Client) contract.Provider

// Global registry instance.
var globalRegistry = NewProviderRegistry()

// ProviderRegistry stores provider factories.
type ProviderRegistry struct {
	mu        sync.RWMutex
	factories map[string]ProviderFactory
}

// NewProviderRegistry creates a new provider registry.
func NewProviderRegistry() *ProviderRegistry {
	return &ProviderRegistry{
		factories: make(map[string]ProviderFactory),
	}
}

// RegisterFactory adds a provider factory to the global registry.
func RegisterFactory(name string, factory ProviderFactory) {
	globalRegistry.RegisterFactory(name, factory)
}

// RegisterFactory adds a provider factory to the registry.
func (r *ProviderRegistry) RegisterFactory(name string, factory ProviderFactory) {
	r.factories[name] = factory
}

// AllFactories returns all registered factories.
func (r *ProviderRegistry) AllFactories() map[string]ProviderFactory {
	return r.factories
}

// GlobalRegistry returns the global provider registry.
func GlobalRegistry() *ProviderRegistry {
	return globalRegistry
}
