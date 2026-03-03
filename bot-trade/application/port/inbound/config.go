package inbound

import (
	"context"

	"bot-trade/domain/aggregate/config"
)

// ConfigManager defines the primary port for configuration operations.
// Implemented by ConfigUseCase, consumed by presentation handlers.
type ConfigManager interface {
	CreateConfig(ctx context.Context, cfg *config.TradingConfig) (string, error)
	GetConfig(ctx context.Context, id string) (*config.TradingConfig, error)
	UpdateConfig(ctx context.Context, id string, cfg *config.TradingConfig) (*config.TradingConfig, error)
	DeleteConfig(ctx context.Context, id string) error
	AddSymbols(ctx context.Context, configID, listType string, symbols []string) error
	RemoveSymbols(ctx context.Context, configID, listType string, symbols []string) error
}
