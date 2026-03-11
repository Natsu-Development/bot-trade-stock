// Package valueobject provides immutable value objects for the config domain.
package valueobject

import (
	"errors"
	"regexp"
	"strings"
)

var (
	ErrInvalidConfigID      = errors.New("config ID must be between 2 and 50 alphanumeric characters, hyphens, or underscores")
	ErrInvalidRSIPeriod     = errors.New("RSI period must be between 2 and 100")
	ErrInvalidPivotPeriod   = errors.New("pivot period must be between 2 and 100")
	ErrInvalidWatchlistType = errors.New("watchlist type must be 'bullish' or 'bearish'")
)

// ConfigID is a unique identifier for trading configurations.
type ConfigID string

var configIDRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// NewConfigID creates a validated ConfigID.
func NewConfigID(value string) (ConfigID, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", ErrInvalidConfigID
	}
	if len(trimmed) < 2 || len(trimmed) > 50 {
		return "", ErrInvalidConfigID
	}
	if !configIDRegex.MatchString(trimmed) {
		return "", ErrInvalidConfigID
	}
	return ConfigID(trimmed), nil
}

// RSIPeriod represents the RSI indicator period.
type RSIPeriod int

// NewRSIPeriod creates a validated RSI period.
func NewRSIPeriod(value int) (RSIPeriod, error) {
	if value < MinPeriod || value > MaxPeriod {
		return 0, ErrInvalidRSIPeriod
	}
	return RSIPeriod(value), nil
}

// PivotPeriod represents the pivot detection period.
type PivotPeriod int

const (
	MinPeriod = 2
	MaxPeriod = 100
)

// NewPivotPeriod creates a validated pivot period.
func NewPivotPeriod(value int) (PivotPeriod, error) {
	if value < MinPeriod || value > MaxPeriod {
		return 0, ErrInvalidPivotPeriod
	}
	return PivotPeriod(value), nil
}

// WatchlistType represents which watchlist a symbol belongs to.
type WatchlistType string

const (
	WatchlistBullish WatchlistType = "bullish"
	WatchlistBearish WatchlistType = "bearish"
)

// NewWatchlistType creates a validated WatchlistType.
func NewWatchlistType(value string) (WatchlistType, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	wt := WatchlistType(normalized)
	if wt == WatchlistBullish || wt == WatchlistBearish {
		return wt, nil
	}
	return "", ErrInvalidWatchlistType
}
