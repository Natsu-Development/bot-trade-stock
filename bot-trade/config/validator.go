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

func getEnvironmentEnv(key string, errors *[]string) string {
	validEnvs := []string{"development", "production"}
	value := strings.ToLower(os.Getenv(key))

	if value == "" {
		*errors = append(*errors, fmt.Sprintf("- %s is required", key))
		return ""
	}

	// Normalize "prod" to "production"
	if value == "prod" {
		value = "production"
	}

	for _, env := range validEnvs {
		if value == env {
			return value
		}
	}

	*errors = append(*errors, fmt.Sprintf("- %s must be one of: %s", key, strings.Join(validEnvs, ", ")))
	return value
}
