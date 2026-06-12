package usecase

import (
	"context"
	"errors"
	"time"

	"backend/application/port/inbound"
	"backend/application/port/outbound"
	"backend/domain/config"
	configagg "backend/domain/config/aggregate"
	configvo "backend/domain/config/valueobject"
	"backend/domain/shared"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

var _ inbound.ConfigManager = (*ConfigUseCase)(nil)

// ConfigUseCase handles configuration business operations.
type ConfigUseCase struct {
	repo outbound.ConfigRepository
	// listeners are notified after UpdateConfig so per-config caches refresh
	// immediately (fresh-on-edit): the screener-flags LRU bust (Compute) and
	// the alert-level recompute (AlertCompute) are separate listeners. Empty by
	// default — CreateConfig and tests need no wiring.
	listeners []inbound.ConfigChangeListener
}

// NewConfigUseCase creates a new ConfigUseCase.
func NewConfigUseCase(repo outbound.ConfigRepository) *ConfigUseCase {
	return &ConfigUseCase{repo: repo}
}

// AddConfigChangeListener registers a fresh-on-edit listener (called at startup by
// the composition root). Listeners are notified in registration order on each
// UpdateConfig.
func (uc *ConfigUseCase) AddConfigChangeListener(l inbound.ConfigChangeListener) {
	uc.listeners = append(uc.listeners, l)
}

// CreateConfig validates and stores a new configuration.
// If cfg.ID is empty, a UUID will be generated.
// If cfg.ID is provided, it will be validated as a username.
func (uc *ConfigUseCase) CreateConfig(ctx context.Context, cfg *configagg.TradingConfig) (string, error) {
	// If no ID provided, generate a UUID
	var emptyID configvo.ConfigID
	if cfg.ID == emptyID {
		configID, err := configvo.NewConfigID(uuid.New().String())
		if err != nil {
			return "", err
		}
		cfg.ID = configID
	} else {
		// Validate the provided config ID (username) is already validated
		// by the value object, just check uniqueness
		_, err := uc.repo.GetByID(ctx, string(cfg.ID))
		if err == nil {
			return "", shared.NewValidationError("config ID already exists")
		}
		if !errors.Is(err, config.ErrConfigNotFound) {
			return "", err
		}
	}

	now := time.Now()
	cfg.CreatedAt = now
	cfg.UpdatedAt = now

	if err := cfg.Validate(); err != nil {
		return "", err
	}

	if err := uc.repo.Create(ctx, cfg); err != nil {
		return "", err
	}

	return string(cfg.ID), nil
}

// GetConfig retrieves configuration by ID.
func (uc *ConfigUseCase) GetConfig(ctx context.Context, id string) (*configagg.TradingConfig, error) {
	return uc.repo.GetByID(ctx, id)
}

// UpdateConfig validates and updates existing configuration.
// Supports partial updates by merging the provided config with existing config.
func (uc *ConfigUseCase) UpdateConfig(ctx context.Context, id string, update *configagg.TradingConfig) (*configagg.TradingConfig, error) {
	existing, err := uc.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Merge partial update with existing config - aggregate handles the logic
	merged, err := existing.Merge(update)
	if err != nil {
		return nil, err
	}

	if err := uc.repo.Update(ctx, merged); err != nil {
		return nil, err
	}

	// Fresh-on-edit: notify each listener so the per-config alert levels + screener
	// LRU refresh immediately. Best-effort — the update already succeeded, so a
	// listener failure is logged, not returned (the next daily refresh recovers).
	for _, l := range uc.listeners {
		if err := l.OnConfigUpdated(ctx, id); err != nil {
			zap.L().Warn("fresh-on-edit listener failed",
				zap.String("config_id", id), zap.Error(err))
		}
	}

	return merged, nil
}

// DeleteConfig removes configuration by ID.
func (uc *ConfigUseCase) DeleteConfig(ctx context.Context, id string) error {
	return uc.repo.Delete(ctx, id)
}
