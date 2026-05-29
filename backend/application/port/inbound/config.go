package inbound

import (
	"context"

	configagg "backend/domain/config/aggregate"
)

// ConfigManager defines the primary port for configuration operations.
// Implemented by ConfigUseCase, consumed by presentation handlers.
type ConfigManager interface {
	CreateConfig(ctx context.Context, cfg *configagg.TradingConfig) (string, error)
	GetConfig(ctx context.Context, id string) (*configagg.TradingConfig, error)
	UpdateConfig(ctx context.Context, id string, cfg *configagg.TradingConfig) (*configagg.TradingConfig, error)
	DeleteConfig(ctx context.Context, id string) error
}
