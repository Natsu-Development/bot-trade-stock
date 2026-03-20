package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// IntervalConfig holds configuration for a single cron interval.
type IntervalConfig struct {
	Enabled  bool
	Schedule string
}

// JobConfig groups all settings for a job type.
type JobConfig struct {
	Timeout     time.Duration
	Concurrency int
	Intervals   map[string]IntervalConfig
}

// InfraConfig holds infrastructure configuration loaded from environment variables.
type InfraConfig struct {
	// Server Configuration
	HTTPPort int

	// HTTP Server Timeouts
	HTTPReadTimeout     int
	HTTPWriteTimeout    int
	HTTPIdleTimeout     int
	HTTPShutdownTimeout int

	// Provider Configuration
	DefaultProviderRPS int    // Default requests per second for adaptive rate limiters
	PrimaryProvider    string // Primary provider name (e.g., "vietcap")

	// MongoDB Configuration
	MongoDBURI      string
	MongoDBDatabase string

	// Job Configurations (grouped)
	BullishJob   JobConfig
	BearishJob   JobConfig
	BreakoutJob  JobConfig
	BreakdownJob JobConfig
	StockRefresh JobConfig

	// Logging Configuration
	LogLevel    string
	Environment string // development, production
}

// LoadInfraFromEnv loads and validates infrastructure configuration from .env file.
func LoadInfraFromEnv() (*InfraConfig, error) {
	if err := godotenv.Load(); err != nil {
		fmt.Printf("Warning: .env file not found, using system environment variables\n")
	}

	var errors []string
	cfg := &InfraConfig{}

	// Server Configuration
	cfg.HTTPPort = getNumberEnv("HTTP_PORT", &errors)

	// HTTP Server Timeouts
	cfg.HTTPReadTimeout = getNumberEnv("HTTP_READ_TIMEOUT", &errors)
	cfg.HTTPWriteTimeout = getNumberEnv("HTTP_WRITE_TIMEOUT", &errors)
	cfg.HTTPIdleTimeout = getNumberEnv("HTTP_IDLE_TIMEOUT", &errors)
	cfg.HTTPShutdownTimeout = getNumberEnv("HTTP_SHUTDOWN_TIMEOUT", &errors)

	// Provider Configuration
	cfg.DefaultProviderRPS = getNumberEnv("DEFAULT_PROVIDER_RPS", &errors)
	cfg.PrimaryProvider = getStringEnv("PRIMARY_PROVIDER", &errors)

	// MongoDB Configuration
	cfg.MongoDBURI = getStringEnv("MONGODB_URI", &errors)
	cfg.MongoDBDatabase = getStringEnv("MONGODB_DATABASE", &errors)

	// Job Configurations
	cfg.BullishJob = loadJobTypeConfig("BULLISH", &errors)
	cfg.BearishJob = loadJobTypeConfig("BEARISH", &errors)
	cfg.BreakoutJob = loadJobTypeConfig("BREAKOUT", &errors)
	cfg.BreakdownJob = loadJobTypeConfig("BREAKDOWN", &errors)
	cfg.StockRefresh = loadStockRefreshConfig(&errors)

	// Logging Configuration
	cfg.LogLevel = getLogLevelEnv("LOG_LEVEL", &errors)
	cfg.Environment = getEnvironmentEnv("ENVIRONMENT", &errors)

	if len(errors) > 0 {
		return nil, fmt.Errorf("configuration validation failed:\n%s", strings.Join(errors, "\n"))
	}

	return cfg, nil
}

// loadJobTypeConfig loads a job type configuration from environment.
func loadJobTypeConfig(prefix string, errors *[]string) JobConfig {
	return JobConfig{
		Timeout:     time.Duration(getNumberEnv(prefix+"_TIMEOUT_MINUTES", errors)) * time.Minute,
		Concurrency: getNumberEnv(prefix+"_CONCURRENCY", errors),
		Intervals: map[string]IntervalConfig{
			"1H": loadIntervalConfig(prefix, "1H", errors),
			"1D": loadIntervalConfig(prefix, "1D", errors),
			"1W": loadIntervalConfig(prefix, "1W", errors),
		},
	}
}

// loadIntervalConfig loads an interval configuration from environment.
func loadIntervalConfig(prefix, interval string, errors *[]string) IntervalConfig {
	return IntervalConfig{
		Enabled:  getBoolEnv(fmt.Sprintf("%s_%s_ENABLED", prefix, interval), errors),
		Schedule: getStringEnv(fmt.Sprintf("%s_%s_SCHEDULE", prefix, interval), errors),
	}
}

// loadStockRefreshConfig loads stock refresh job configuration.
func loadStockRefreshConfig(errors *[]string) JobConfig {
	return JobConfig{
		Timeout: time.Duration(getNumberEnv("STOCK_REFRESH_TIMEOUT_MINUTES", errors)) * time.Minute,
		Intervals: map[string]IntervalConfig{
			"default": {
				Enabled:  getBoolEnv("STOCK_REFRESH_ENABLED", errors),
				Schedule: getStringEnv("STOCK_REFRESH_SCHEDULE", errors),
			},
		},
	}
}

// LoggerConfig holds logger-specific configuration.
type LoggerConfig struct {
	Level       string
	Environment string
}

// Logger returns the logger configuration.
func (c *InfraConfig) Logger() LoggerConfig {
	return LoggerConfig{
		Level:       c.LogLevel,
		Environment: c.Environment,
	}
}

