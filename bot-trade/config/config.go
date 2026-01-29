package config

import (
	"fmt"
	"strings"

	"github.com/joho/godotenv"
)

// InfraConfig holds infrastructure configuration loaded from environment variables.
// This configuration is immutable at runtime and used for deployment-specific settings.
type InfraConfig struct {
	// Server Configuration
	HTTPPort int

	// HTTP Server Timeouts
	HTTPReadTimeout     int
	HTTPWriteTimeout    int
	HTTPIdleTimeout     int
	HTTPShutdownTimeout int

	// VietCap API Configuration
	VietCapRateLimit int // Requests per minute (default: 15)

	// MongoDB Configuration
	MongoDBURI      string
	MongoDBDatabase string

	// Bearish Divergence Configuration
	BearishCronAutoStart bool // Auto-start on application boot

	// Bearish Intervals - Enable specific intervals
	Bearish30mEnabled  bool
	Bearish30mSchedule string
	Bearish1HEnabled   bool
	Bearish1HSchedule  string
	Bearish1DEnabled   bool
	Bearish1DSchedule  string
	Bearish1WEnabled   bool
	Bearish1WSchedule  string

	// Bullish Divergence Configuration
	BullishCronAutoStart bool // Auto-start on application boot

	// Bullish Intervals - Enable specific intervals
	Bullish30mEnabled  bool
	Bullish30mSchedule string
	Bullish1HEnabled   bool
	Bullish1HSchedule  string
	Bullish1DEnabled   bool
	Bullish1DSchedule  string
	Bullish1WEnabled   bool
	Bullish1WSchedule  string

	// Logging Configuration
	LogLevel    string
	Environment string // development, production
}

// LoadInfraFromEnv loads and validates infrastructure configuration from .env file.
// Returns InfraConfig or error if required variables are missing.
func LoadInfraFromEnv() (*InfraConfig, error) {
	// Load .env file (optional)
	if err := godotenv.Load(); err != nil {
		fmt.Printf("Warning: .env file not found, using system environment variables\n")
	}

	var errors []string
	config := &InfraConfig{}

	// Server Configuration
	config.HTTPPort = getNumberEnv("HTTP_PORT", &errors)

	// HTTP Server Timeouts
	config.HTTPReadTimeout = getNumberEnv("HTTP_READ_TIMEOUT", &errors)
	config.HTTPWriteTimeout = getNumberEnv("HTTP_WRITE_TIMEOUT", &errors)
	config.HTTPIdleTimeout = getNumberEnv("HTTP_IDLE_TIMEOUT", &errors)
	config.HTTPShutdownTimeout = getNumberEnv("HTTP_SHUTDOWN_TIMEOUT", &errors)

	// VietCap API Configuration
	config.VietCapRateLimit = getOptionalNumberEnv("VIETCAP_RATE_LIMIT", 120) // Default: 120 req/min

	// MongoDB Configuration
	config.MongoDBURI = getStringEnv("MONGODB_URI", &errors)
	config.MongoDBDatabase = getStringEnv("MONGODB_DATABASE", &errors)

	// Bearish Divergence Configuration
	config.BearishCronAutoStart = getBoolEnv("BEARISH_CRON_AUTO_START", &errors)

	// Bearish Intervals (at least one should be enabled)
	config.Bearish30mEnabled = getOptionalBoolEnv("BEARISH_30M_ENABLED")
	config.Bearish30mSchedule = getOptionalStringEnv("BEARISH_30M_SCHEDULE")
	config.Bearish1HEnabled = getOptionalBoolEnv("BEARISH_1H_ENABLED")
	config.Bearish1HSchedule = getOptionalStringEnv("BEARISH_1H_SCHEDULE")
	config.Bearish1DEnabled = getOptionalBoolEnv("BEARISH_1D_ENABLED")
	config.Bearish1DSchedule = getOptionalStringEnv("BEARISH_1D_SCHEDULE")
	config.Bearish1WEnabled = getOptionalBoolEnv("BEARISH_1W_ENABLED")
	config.Bearish1WSchedule = getOptionalStringEnv("BEARISH_1W_SCHEDULE")

	// Bullish Divergence Configuration
	config.BullishCronAutoStart = getBoolEnv("BULLISH_CRON_AUTO_START", &errors)

	// Bullish Intervals (at least one should be enabled)
	config.Bullish30mEnabled = getOptionalBoolEnv("BULLISH_30M_ENABLED")
	config.Bullish30mSchedule = getOptionalStringEnv("BULLISH_30M_SCHEDULE")
	config.Bullish1HEnabled = getOptionalBoolEnv("BULLISH_1H_ENABLED")
	config.Bullish1HSchedule = getOptionalStringEnv("BULLISH_1H_SCHEDULE")
	config.Bullish1DEnabled = getOptionalBoolEnv("BULLISH_1D_ENABLED")
	config.Bullish1DSchedule = getOptionalStringEnv("BULLISH_1D_SCHEDULE")
	config.Bullish1WEnabled = getOptionalBoolEnv("BULLISH_1W_ENABLED")
	config.Bullish1WSchedule = getOptionalStringEnv("BULLISH_1W_SCHEDULE")

	// Logging Configuration
	config.LogLevel = getLogLevelEnv("LOG_LEVEL", &errors)
	config.Environment = getEnvironmentEnv("ENVIRONMENT")

	if len(errors) > 0 {
		return nil, fmt.Errorf("configuration validation failed:\n%s", strings.Join(errors, "\n"))
	}

	return config, nil
}

// IntervalConfig holds configuration for a single cron interval.
type IntervalConfig struct {
	Enabled  bool
	Schedule string
}

// BullishIntervals returns the interval configuration map for bullish analysis.
func (c *InfraConfig) BullishIntervals() map[string]IntervalConfig {
	return map[string]IntervalConfig{
		"30m": {Enabled: c.Bullish30mEnabled, Schedule: c.Bullish30mSchedule},
		"1H":  {Enabled: c.Bullish1HEnabled, Schedule: c.Bullish1HSchedule},
		"1D":  {Enabled: c.Bullish1DEnabled, Schedule: c.Bullish1DSchedule},
		"1W":  {Enabled: c.Bullish1WEnabled, Schedule: c.Bullish1WSchedule},
	}
}

// BearishIntervals returns the interval configuration map for bearish analysis.
func (c *InfraConfig) BearishIntervals() map[string]IntervalConfig {
	return map[string]IntervalConfig{
		"30m": {Enabled: c.Bearish30mEnabled, Schedule: c.Bearish30mSchedule},
		"1H":  {Enabled: c.Bearish1HEnabled, Schedule: c.Bearish1HSchedule},
		"1D":  {Enabled: c.Bearish1DEnabled, Schedule: c.Bearish1DSchedule},
		"1W":  {Enabled: c.Bearish1WEnabled, Schedule: c.Bearish1WSchedule},
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
