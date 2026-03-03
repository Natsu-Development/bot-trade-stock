package usecase

import (
	"context"
	"errors"
	"strings"
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

// CreateConfig validates and stores a new configuration.
// If cfg.ID is empty, a UUID will be generated.
// If cfg.ID is provided, it will be validated as a username.
func (uc *ConfigUseCase) CreateConfig(ctx context.Context, cfg *config.TradingConfig) (string, error) {
	// If no ID provided, generate a UUID
	if cfg.ID == "" {
		cfg.ID = uuid.New().String()
	} else {
		// Validate the provided config ID (username)
		if err := config.ValidateConfigID(cfg.ID); err != nil {
			return "", err
		}

		// Check if config ID already exists
		_, err := uc.repo.GetByID(ctx, cfg.ID)
		if err == nil {
			return "", &config.ValidationError{Errors: []string{"config ID already exists"}}
		}
		if !errors.Is(err, config.ErrConfigNotFound) {
			return "", err
		}
	}

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
// Supports partial updates by merging the provided config with existing config.
func (uc *ConfigUseCase) UpdateConfig(ctx context.Context, id string, cfg *config.TradingConfig) (*config.TradingConfig, error) {
	existing, err := uc.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Merge partial update with existing config
	merged := uc.mergeConfig(existing, cfg)

	if err := merged.Validate(); err != nil {
		return nil, err
	}

	if err := uc.repo.Update(ctx, merged); err != nil {
		return nil, err
	}

	return merged, nil
}

// mergeConfig merges a partial config update with an existing config.
// Only non-zero/empty fields from the update override existing values.
func (uc *ConfigUseCase) mergeConfig(existing *config.TradingConfig, update *config.TradingConfig) *config.TradingConfig {
	merged := *existing

	// Override fields that are explicitly set in the update
	if update.RSIPeriod > 0 {
		merged.RSIPeriod = update.RSIPeriod
	}
	if update.StartDateOffset > 0 {
		merged.StartDateOffset = update.StartDateOffset
	}
	if update.EarlyDetectionEnabled {
		merged.EarlyDetectionEnabled = update.EarlyDetectionEnabled
	}

	// Merge divergence config (only if non-zero values are provided)
	if update.Divergence.LookbackLeft > 0 {
		merged.Divergence.LookbackLeft = update.Divergence.LookbackLeft
	}
	if update.Divergence.LookbackRight > 0 {
		merged.Divergence.LookbackRight = update.Divergence.LookbackRight
	}
	if update.Divergence.RangeMin > 0 {
		merged.Divergence.RangeMin = update.Divergence.RangeMin
	}
	if update.Divergence.RangeMax > 0 {
		merged.Divergence.RangeMax = update.Divergence.RangeMax
	}
	if update.Divergence.IndicesRecent > 0 {
		merged.Divergence.IndicesRecent = update.Divergence.IndicesRecent
	}

	// Override symbol lists if provided (non-empty)
	if len(update.BearishSymbols) > 0 {
		merged.BearishSymbols = update.BearishSymbols
	}
	if len(update.BullishSymbols) > 0 {
		merged.BullishSymbols = update.BullishSymbols
	}

	// Merge telegram config
	if update.Telegram.BotToken != "" || update.Telegram.ChatID != "" || update.Telegram.Enabled {
		if update.Telegram.Enabled {
			merged.Telegram.Enabled = true
			if update.Telegram.BotToken != "" {
				merged.Telegram.BotToken = update.Telegram.BotToken
			}
			if update.Telegram.ChatID != "" {
				merged.Telegram.ChatID = update.Telegram.ChatID
			}
		} else {
			// Explicitly disable
			merged.Telegram.Enabled = false
		}
	}

	// Always merge screener_filters if provided (even if empty, to allow clearing)
	if update.ScreenerFilterPresets != nil {
		merged.ScreenerFilterPresets = update.ScreenerFilterPresets
	}

	merged.UpdatedAt = time.Now()

	return &merged
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

	// Normalize list type
	listType = strings.ToLower(listType)

	// Add symbols to appropriate list, avoiding duplicates
	switch listType {
	case "bullish":
		cfg.BullishSymbols = appendUnique(cfg.BullishSymbols, symbols...)
	case "bearish":
		cfg.BearishSymbols = appendUnique(cfg.BearishSymbols, symbols...)
	default:
		return &config.ValidationError{Errors: []string{"list_type must be 'bullish' or 'bearish'"}}
	}

	cfg.UpdatedAt = time.Now()

	return uc.repo.Update(ctx, cfg)
}

// RemoveSymbols removes symbols from the specified watchlist (bullish or bearish).
func (uc *ConfigUseCase) RemoveSymbols(ctx context.Context, configID string, listType string, symbols []string) error {
	cfg, err := uc.repo.GetByID(ctx, configID)
	if err != nil {
		return err
	}

	// Normalize list type
	listType = strings.ToLower(listType)

	// Remove symbols from appropriate list
	switch listType {
	case "bullish":
		cfg.BullishSymbols = removeSymbols(cfg.BullishSymbols, symbols...)
	case "bearish":
		cfg.BearishSymbols = removeSymbols(cfg.BearishSymbols, symbols...)
	default:
		return &config.ValidationError{Errors: []string{"list_type must be 'bullish' or 'bearish'"}}
	}

	cfg.UpdatedAt = time.Now()

	return uc.repo.Update(ctx, cfg)
}

// appendUnique adds symbols to a slice, avoiding duplicates.
func appendUnique(slice []string, newSymbols ...string) []string {
	existing := make(map[string]bool)
	for _, s := range slice {
		existing[s] = true
	}

	for _, s := range newSymbols {
		if !existing[s] {
			slice = append(slice, s)
			existing[s] = true
		}
	}
	return slice
}

// removeSymbols removes specified symbols from a slice.
func removeSymbols(slice []string, symbolsToRemove ...string) []string {
	toRemove := make(map[string]bool)
	for _, s := range symbolsToRemove {
		toRemove[s] = true
	}

	result := make([]string, 0, len(slice))
	for _, s := range slice {
		if !toRemove[s] {
			result = append(result, s)
		}
	}
	return result
}
