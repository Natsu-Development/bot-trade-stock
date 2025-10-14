package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Config holds logger configuration
type Config struct {
	Level       string // debug, info, warn, error
	Environment string // development, production
	Encoding    string // json, console
}

// DefaultConfig returns default logger configuration
func DefaultConfig() *Config {
	return &Config{
		Level:       "info",
		Environment: "development",
		Encoding:    "console",
	}
}

// New creates a new zap logger with the specified configuration
func New(config *Config) (*zap.Logger, error) {
	var zapConfig zap.Config

	if config.Environment == "production" {
		zapConfig = zap.NewProductionConfig()
		zapConfig.Encoding = "json"
	} else {
		zapConfig = zap.NewDevelopmentConfig()
		zapConfig.Encoding = "console"
		zapConfig.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	// Override encoding if specified
	if config.Encoding != "" {
		zapConfig.Encoding = config.Encoding
	}

	// Set log level
	level, err := zapcore.ParseLevel(config.Level)
	if err != nil {
		level = zapcore.InfoLevel
	}
	zapConfig.Level.SetLevel(level)

	logger, err := zapConfig.Build()
	if err != nil {
		return nil, err
	}

	return logger, nil
}

// NewWithDefaults creates a new logger with default configuration
func NewWithDefaults() (*zap.Logger, error) {
	return New(DefaultConfig())
}

// SetGlobal sets the global zap logger
func SetGlobal(logger *zap.Logger) {
	zap.ReplaceGlobals(logger)
}
