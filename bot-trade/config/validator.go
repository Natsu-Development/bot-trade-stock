package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Validation helpers
func getStringEnv(key string, errors *[]string) string {
	value := os.Getenv(key)
	if value == "" {
		*errors = append(*errors, fmt.Sprintf("- %s is required", key))
	}
	return value
}

func getOptionalStringEnv(key string) string {
	return os.Getenv(key)
}

func getOptionalBoolEnv(key string) bool {
	value := os.Getenv(key)
	if value == "" {
		return false
	}
	boolValue, _ := strconv.ParseBool(value)
	return boolValue
}

func getOptionalNumberEnv(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	intValue, err := strconv.Atoi(value)
	if err != nil || intValue <= 0 {
		return defaultValue
	}
	return intValue
}

func getNumberEnv(key string, errors *[]string) int {
	value := os.Getenv(key)
	if value == "" {
		*errors = append(*errors, fmt.Sprintf("- %s is required", key))
		return 0
	}

	intValue, err := strconv.Atoi(value)
	if err != nil || intValue <= 0 {
		*errors = append(*errors, fmt.Sprintf("- %s must be a valid positive integer", key))
		return 0
	}

	return intValue
}

func getBoolEnv(key string, errors *[]string) bool {
	value := os.Getenv(key)
	if value == "" {
		*errors = append(*errors, fmt.Sprintf("- %s is required (true or false)", key))
		return false
	}

	boolValue, err := strconv.ParseBool(value)
	if err != nil {
		*errors = append(*errors, fmt.Sprintf("- %s must be true or false", key))
		return false
	}

	return boolValue
}

func getSymbolListEnv(key string, errors *[]string) []string {
	value := os.Getenv(key)
	if value == "" {
		*errors = append(*errors, fmt.Sprintf("- %s is required", key))
		return nil
	}

	symbols := strings.Split(value, ",")
	var cleanSymbols []string
	for _, symbol := range symbols {
		if trimmed := strings.TrimSpace(symbol); trimmed != "" {
			cleanSymbols = append(cleanSymbols, trimmed)
		}
	}

	if len(cleanSymbols) == 0 {
		*errors = append(*errors, fmt.Sprintf("- %s must contain at least one valid symbol", key))
		return nil
	}

	return cleanSymbols
}

func getLogLevelEnv(key string, errors *[]string) string {
	validLevels := []string{"debug", "info", "warn", "error"}
	value := strings.ToLower(os.Getenv(key))

	if value == "" {
		*errors = append(*errors, fmt.Sprintf("- %s is required", key))
		return ""
	}

	for _, level := range validLevels {
		if value == level {
			return value
		}
	}

	*errors = append(*errors, fmt.Sprintf("- %s must be one of: %s", key, strings.Join(validLevels, ", ")))
	return value
}

func getEnvironmentEnv(key string) string {
	value := strings.ToLower(os.Getenv(key))
	if value == "production" || value == "prod" {
		return "production"
	}
	return "development"
}
