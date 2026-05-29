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
	// IgnoreSessionGate, when true, makes the job execute every cron tick
	// regardless of the HoSE intraday session window. Intended for local
	// development; production should leave this false so ATO (09:00-09:15)
	// and lunch (11:30-13:00) ticks are skipped. Currently consumed only by
	// StockAlertJob (env: STOCK_ALERT_IGNORE_SESSION_GATE).
	IgnoreSessionGate bool
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
	DefaultProviderRPS int    // Initial requests per second for adaptive token bucket
	MaxProviderRPS     int    // Hard ceiling for adaptive token bucket
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
	StockAlert   JobConfig

	// Logging Configuration
	LogLevel    string
	Environment string // development, production

	// Cron Configuration
	CronTimezone string // Cron scheduler timezone (e.g., "Asia/Ho_Chi_Minh")

	// SSI Configuration
	SSICredentialsEnvPath string // Path to the SSI credentials env file (SSI_CREDENTIALS_ENV_PATH)
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
	cfg.MaxProviderRPS = getNumberEnv("MAX_PROVIDER_RPS", &errors)
	cfg.PrimaryProvider = getStringEnv("PRIMARY_PROVIDER", &errors)

	// MongoDB Configuration
	cfg.MongoDBURI = getStringEnv("MONGODB_URI", &errors)
	cfg.MongoDBDatabase = getStringEnv("MONGODB_DATABASE", &errors)

	// Job Configurations
	// RSI divergence jobs run on 1H/1D/1W. Breakout/breakdown intentionally omit
	// 1D: the daily trendline approach is already covered in real time by the
	// tick alert job's trendline_breakout / trendline_breakdown conditions
	// (metrics.{Resistance,Support}Level are built from 1D trendlines), so a 1D
	// MTF run would duplicate it. The MTF jobs add value on 1H/1W.
	cfg.BullishJob = loadJobTypeConfig("BULLISH", []string{"1H", "1D", "1W"}, &errors)
	cfg.BearishJob = loadJobTypeConfig("BEARISH", []string{"1H", "1D", "1W"}, &errors)
	cfg.BreakoutJob = loadJobTypeConfig("BREAKOUT", []string{"1H", "1W"}, &errors)
	cfg.BreakdownJob = loadJobTypeConfig("BREAKDOWN", []string{"1H", "1W"}, &errors)
	cfg.StockRefresh = loadStockRefreshConfig(&errors)
	cfg.StockAlert = loadStockAlertConfig(&errors)

	// Logging Configuration
	cfg.LogLevel = getLogLevelEnv("LOG_LEVEL", &errors)
	cfg.Environment = getEnvironmentEnv("ENVIRONMENT", &errors)

	// Cron Configuration
	cfg.CronTimezone = getStringEnv("CRON_TIMEZONE", &errors)

	// SSI Configuration
	// Credentials are required + fail-fast verified only in production, where SSI
	// gates the quote API behind a Cloudflare challenge. Non-production fetches
	// quotes without the challenge, so the path is optional there.
	if cfg.Environment == "production" {
		cfg.SSICredentialsEnvPath = getStringEnv("SSI_CREDENTIALS_ENV_PATH", &errors)
	} else {
		cfg.SSICredentialsEnvPath = getOptionalStringEnv("SSI_CREDENTIALS_ENV_PATH")
	}

	if len(errors) > 0 {
		return nil, fmt.Errorf("configuration validation failed:\n%s", strings.Join(errors, "\n"))
	}

	return cfg, nil
}

// loadJobTypeConfig loads a job type configuration from environment for the
// given intervals. Only the listed intervals' *_ENABLED/*_SCHEDULE env vars are
// read, so a job type that omits an interval (breakout/breakdown omit 1D)
// neither requires nor consumes that interval's env vars.
func loadJobTypeConfig(prefix string, intervals []string, errors *[]string) JobConfig {
	ivMap := make(map[string]IntervalConfig, len(intervals))
	for _, iv := range intervals {
		ivMap[iv] = loadIntervalConfig(prefix, iv, errors)
	}
	return JobConfig{
		Timeout:     time.Duration(getNumberEnv(prefix+"_TIMEOUT_MINUTES", errors)) * time.Minute,
		Concurrency: getNumberEnv(prefix+"_CONCURRENCY", errors),
		Intervals:   ivMap,
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
		Timeout:     time.Duration(getNumberEnv("STOCK_REFRESH_TIMEOUT_MINUTES", errors)) * time.Minute,
		Concurrency: getNumberEnv("STOCK_REFRESH_CONCURRENCY", errors),
		Intervals: map[string]IntervalConfig{
			"default": {
				Enabled:  getBoolEnv("STOCK_REFRESH_ENABLED", errors),
				Schedule: getStringEnv("STOCK_REFRESH_SCHEDULE", errors),
			},
		},
	}
}

// loadStockAlertConfig loads stock alert job configuration.
func loadStockAlertConfig(errors *[]string) JobConfig {
	return JobConfig{
		Timeout:           time.Duration(getNumberEnv("STOCK_ALERT_TIMEOUT_MINUTES", errors)) * time.Minute,
		IgnoreSessionGate: getBoolEnv("STOCK_ALERT_IGNORE_SESSION_GATE", errors),
		Intervals: map[string]IntervalConfig{
			"default": {
				Enabled:  getBoolEnv("STOCK_ALERT_ENABLED", errors),
				Schedule: getStringEnv("STOCK_ALERT_SCHEDULE", errors),
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
