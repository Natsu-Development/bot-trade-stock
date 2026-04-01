package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	"bot-trade/domain/config"
	configagg "bot-trade/domain/config/aggregate"
	configvo "bot-trade/domain/config/valueobject"
	"bot-trade/domain/shared"
	marketvo "bot-trade/domain/shared/valueobject/market"

	"github.com/google/uuid"
)

var _ inbound.ConfigManager = (*ConfigUseCase)(nil)

// ConfigUseCase handles configuration business operations.
type ConfigUseCase struct {
	repo outbound.ConfigRepository
}

// NewConfigUseCase creates a new ConfigUseCase.
func NewConfigUseCase(repo outbound.ConfigRepository) *ConfigUseCase {
	return &ConfigUseCase{repo: repo}
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

	return merged, nil
}

// DeleteConfig removes configuration by ID.
func (uc *ConfigUseCase) DeleteConfig(ctx context.Context, id string) error {
	return uc.repo.Delete(ctx, id)
}

// AddSymbols adds symbols to the specified watchlist (bullish or bearish).
func (uc *ConfigUseCase) AddSymbols(ctx context.Context, configID string, listType string, symbols []string) error {
	cfg, err := uc.repo.GetByID(ctx, configID)
	if err != nil {
		return err
	}

	wt, err := configvo.NewWatchlistType(listType)
	if err != nil {
		return shared.NewValidationError(err.Error())
	}

	// Add each symbol using aggregate method
	for _, symStr := range symbols {
		symbol, err := marketvo.NewSymbol(symStr)
		if err != nil {
			return shared.NewValidationError(fmt.Sprintf("invalid symbol '%s': %s", symStr, err.Error()))
		}
		if err := cfg.AddSymbol(wt, symbol); err != nil {
			return err
		}
	}

	return uc.repo.Update(ctx, cfg)
}

// RemoveSymbols removes symbols from the specified watchlist (bullish or bearish).
func (uc *ConfigUseCase) RemoveSymbols(ctx context.Context, configID string, listType string, symbols []string) error {
	cfg, err := uc.repo.GetByID(ctx, configID)
	if err != nil {
		return err
	}

	wt, err := configvo.NewWatchlistType(listType)
	if err != nil {
		return shared.NewValidationError(err.Error())
	}

	// Remove each symbol using aggregate method
	for _, symStr := range symbols {
		symbol, err := marketvo.NewSymbol(symStr)
		if err != nil {
			return shared.NewValidationError(fmt.Sprintf("invalid symbol '%s': %s", symStr, err.Error()))
		}
		if err := cfg.RemoveSymbol(wt, symbol); err != nil {
			return err
		}
	}

	return uc.repo.Update(ctx, cfg)
}
