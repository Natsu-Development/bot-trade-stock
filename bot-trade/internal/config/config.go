package config

import (
	"fmt"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds application configuration
type Config struct {
	// Server Configuration
	GRPCServerAddr string
	HTTPPort       int

	// HTTP Server Timeouts
	HTTPReadTimeout     int
	HTTPWriteTimeout    int
	HTTPIdleTimeout     int
	HTTPShutdownTimeout int

	// gRPC Client Configuration
	GRPCConnectionTimeout int
	GRPCRequestTimeout    int
	GRPCMarketDataTimeout int

	// RSI Configuration
	RSIPeriod                     int
	RSIOverboughtThreshold        int
	RSIOversoldThreshold          int
	RSIExtremeOverboughtThreshold int
	RSIExtremeOversoldThreshold   int

	// Divergence Detection Configuration
	DivergenceLookbackLeft  int
	DivergenceLookbackRight int
	DivergenceRangeMin      int
	DivergenceRangeMax      int
	DivergenceIndicesRecent int

	// Business Rules Configuration
	MinAnalysisDays  int
	MaxDateRangeDays int
	MinSymbolLength  int
	MaxSymbolLength  int
	CronJobTimeout   int

	// Bearish Divergence Configuration
	BearishCronStartDateOffset int  // Days back for historical data
	BearishCronAutoStart       bool // Auto-start on application boot

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
	BullishCronStartDateOffset int  // Days back for historical data
	BullishCronAutoStart       bool // Auto-start on application boot

	// Bullish Intervals - Enable specific intervals
	Bullish30mEnabled  bool
	Bullish30mSchedule string
	Bullish1HEnabled   bool
	Bullish1HSchedule  string
	Bullish1DEnabled   bool
	Bullish1DSchedule  string
	Bullish1WEnabled   bool
	Bullish1WSchedule  string

	// Common Cron Configuration
	DefaultSymbols []string

	// Logging Configuration
	LogLevel string

	// Telegram Notification Configuration
	TelegramEnabled  bool
	TelegramBotToken string
	TelegramChatID   string
}

// LoadFromEnv loads and validates configuration from .env file
func LoadFromEnv() (*Config, error) {
	// Load .env file (optional)
	if err := godotenv.Load(); err != nil {
		fmt.Printf("Warning: .env file not found, using system environment variables\n")
	}

	var errors []string
	config := &Config{}

	// Server Configuration
	config.GRPCServerAddr = getStringEnv("GRPC_SERVER_ADDR", &errors)
	config.HTTPPort = getNumberEnv("HTTP_PORT", &errors)

	// HTTP Server Timeouts
	config.HTTPReadTimeout = getNumberEnv("HTTP_READ_TIMEOUT", &errors)
	config.HTTPWriteTimeout = getNumberEnv("HTTP_WRITE_TIMEOUT", &errors)
	config.HTTPIdleTimeout = getNumberEnv("HTTP_IDLE_TIMEOUT", &errors)
	config.HTTPShutdownTimeout = getNumberEnv("HTTP_SHUTDOWN_TIMEOUT", &errors)

	// gRPC Client Configuration
	config.GRPCConnectionTimeout = getNumberEnv("GRPC_CONNECTION_TIMEOUT", &errors)
	config.GRPCRequestTimeout = getNumberEnv("GRPC_REQUEST_TIMEOUT", &errors)
	config.GRPCMarketDataTimeout = getNumberEnv("GRPC_MARKET_DATA_TIMEOUT", &errors)

	// RSI Configuration
	config.RSIPeriod = getNumberEnv("RSI_PERIOD", &errors)

	// Divergence Detection Configuration
	config.DivergenceLookbackLeft = getNumberEnv("DIVERGENCE_LOOKBACK_LEFT", &errors)
	config.DivergenceLookbackRight = getNumberEnv("DIVERGENCE_LOOKBACK_RIGHT", &errors)
	config.DivergenceRangeMin = getNumberEnv("DIVERGENCE_RANGE_MIN", &errors)
	config.DivergenceRangeMax = getNumberEnv("DIVERGENCE_RANGE_MAX", &errors)
	config.DivergenceIndicesRecent = getNumberEnv("DIVERGENCE_INDICES_RECENT", &errors)

	// Business Rules Configuration
	config.MinAnalysisDays = getNumberEnv("MIN_ANALYSIS_DAYS", &errors)
	config.MaxDateRangeDays = getNumberEnv("MAX_DATE_RANGE_DAYS", &errors)
	config.MinSymbolLength = getNumberEnv("MIN_SYMBOL_LENGTH", &errors)
	config.MaxSymbolLength = getNumberEnv("MAX_SYMBOL_LENGTH", &errors)
	config.CronJobTimeout = getNumberEnv("CRON_JOB_TIMEOUT", &errors)

	// Bearish Divergence Configuration
	config.BearishCronStartDateOffset = getNumberEnv("BEARISH_CRON_START_DATE_OFFSET", &errors)
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
	config.BullishCronStartDateOffset = getNumberEnv("BULLISH_CRON_START_DATE_OFFSET", &errors)
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

	// Common Cron Configuration
	config.DefaultSymbols = getSymbolListEnv("DEFAULT_SYMBOLS", &errors)

	// Logging Configuration
	config.LogLevel = getLogLevelEnv("LOG_LEVEL", &errors)

	// Telegram Notification Configuration (optional)
	config.TelegramEnabled = getOptionalBoolEnv("TELEGRAM_ENABLED")
	config.TelegramBotToken = getOptionalStringEnv("TELEGRAM_BOT_TOKEN")
	config.TelegramChatID = getOptionalStringEnv("TELEGRAM_CHAT_ID")

	if len(errors) > 0 {
		return nil, fmt.Errorf("configuration validation failed:\n%s", strings.Join(errors, "\n"))
	}

	return config, nil
}
