// Package config defines trading configuration domain types.
package config

import "errors"

var (
	// ErrConfigNotFound indicates the requested config ID does not exist.
	ErrConfigNotFound = errors.New("configuration not found")

	// ErrConfigValidation indicates the configuration failed validation.
	ErrConfigValidation = errors.New("configuration validation failed")
)
