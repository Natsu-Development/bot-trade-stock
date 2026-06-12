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

// ConfigChangeListener is notified AFTER a config is updated (UpdateConfig) so
// downstream per-config caches refresh immediately rather than waiting for the next
// daily refresh — the watchlist's per-config alert-level store is recomputed/swapped.
// (The screener signal cache needs no explicit bust: its UpdatedAt-stamped LRU
// self-invalidates on the next Compute.)
//
// Implemented by metrics.UseCase (which recomputes that config's alert levels),
// registered on ConfigUseCase; CreateConfig and tests stay wiring-free. Mirrors the
// injected-seam shape of ConditionDisabler (no event bus). Emitted ONLY from
// UpdateConfig — NOT from SetConditionEnabled (the auto-disable seam).
type ConfigChangeListener interface {
	OnConfigUpdated(ctx context.Context, configID string) error
}
