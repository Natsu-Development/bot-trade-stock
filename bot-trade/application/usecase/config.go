package usecase

import (
	"context"
	"time"

	"bot-trade/domain/aggregate/config"
	infraPort "bot-trade/infrastructure/port"

	"github.com/google/uuid"
)

// ConfigUseCase handles configuration business operations.
type ConfigUseCase struct {
	repo infraPort.ConfigRepository
}

// NewConfigUseCase creates a new ConfigUseCase.
func NewConfigUseCase(repo infraPort.ConfigRepository) *ConfigUseCase {
	return &ConfigUseCase{repo: repo}
}

// CreateConfig generates ID, validates, and stores new configuration.
func (uc *ConfigUseCase) CreateConfig(ctx context.Context, cfg *config.TradingConfig) (string, error) {
	cfg.ID = uuid.New().String()
	cfg.CreatedAt = time.Now()
	cfg.UpdatedAt = time.Now()

	if err := cfg.Validate(); err != nil {
		return "", err
	}

	if err := uc.repo.Create(ctx, cfg); err != nil {
		return "", err
	}

	return cfg.ID, nil
}

// GetConfig retrieves configuration by ID.
func (uc *ConfigUseCase) GetConfig(ctx context.Context, id string) (*config.TradingConfig, error) {
	return uc.repo.GetByID(ctx, id)
}

// UpdateConfig validates and updates existing configuration.
func (uc *ConfigUseCase) UpdateConfig(ctx context.Context, id string, cfg *config.TradingConfig) (*config.TradingConfig, error) {
	existing, err := uc.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	cfg.ID = id
	cfg.CreatedAt = existing.CreatedAt
	cfg.UpdatedAt = time.Now()

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	if err := uc.repo.Update(ctx, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

// DeleteConfig removes configuration by ID.
func (uc *ConfigUseCase) DeleteConfig(ctx context.Context, id string) error {
	return uc.repo.Delete(ctx, id)
}
