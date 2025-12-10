// Package logger provides zap logger factory functions.
// This package is a pure factory with no interface knowledge.
// The application layer defines interfaces, infrastructure adapts them.
package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Config holds logger configuration.
type Config struct {
	Level       string // debug, info, warn, error
	Environment string // development, production
}

// New creates a new zap logger with the specified configuration.
func New(cfg Config) (*zap.Logger, error) {
	var zapConfig zap.Config

	if cfg.Environment == "production" {
		zapConfig = zap.NewProductionConfig()
		zapConfig.Encoding = "json"
	} else {
		zapConfig = zap.NewDevelopmentConfig()
		zapConfig.Encoding = "console"
		zapConfig.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	level, err := zapcore.ParseLevel(cfg.Level)
	if err != nil {
		level = zapcore.InfoLevel
	}
	zapConfig.Level.SetLevel(level)

	return zapConfig.Build()
}

// NewDevelopment creates a development logger with sensible defaults.
func NewDevelopment() (*zap.Logger, error) {
	return New(Config{
		Level:       "debug",
		Environment: "development",
	})
}

// NewProduction creates a production logger with sensible defaults.
func NewProduction() (*zap.Logger, error) {
	return New(Config{
		Level:       "info",
		Environment: "production",
	})
}
