package port

import (
	"context"

	"bot-trade/domain/aggregate/config"
)

// ConfigRepository defines the interface for TradingConfig persistence.
type ConfigRepository interface {
	// Create inserts a new configuration document.
	// ID must be pre-generated and set on config.
	Create(ctx context.Context, cfg *config.TradingConfig) error

	// GetByID retrieves configuration by its unique ID.
	// Returns config.ErrConfigNotFound if document does not exist.
	GetByID(ctx context.Context, id string) (*config.TradingConfig, error)

	// GetAll retrieves all configuration documents.
	GetAll(ctx context.Context) ([]*config.TradingConfig, error)

	// Update replaces an existing configuration document.
	// Returns config.ErrConfigNotFound if document does not exist.
	Update(ctx context.Context, cfg *config.TradingConfig) error

	// Delete removes a configuration document by ID.
	// Returns config.ErrConfigNotFound if document does not exist.
	Delete(ctx context.Context, id string) error
}
