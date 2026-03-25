// Package market provides shared immutable value objects for market and trading bounded contexts.
// This is part of the Shared Kernel pattern - explicitly shared model elements that
// all contexts agree on and use consistently.
package market

import (
	"errors"
	"strings"
)

var (
	// ErrInvalidExchange is returned when exchange validation fails.
	ErrInvalidExchange = errors.New("invalid exchange: must be HOSE, HNX, or UPCOM")
	// ErrEmptyExchange is returned when exchange is empty.
	ErrEmptyExchange = errors.New("exchange cannot be empty")
)

// Exchange is a value object representing a Vietnamese stock exchange.
// Immutable - use NewExchange to create validated instances.
type Exchange string

const (
	ExchangeHOSE  Exchange = "HOSE"
	ExchangeHNX   Exchange = "HNX"
	ExchangeUPCOM Exchange = "UPCOM"
)

// NewExchange creates a validated Exchange.
func NewExchange(value string) (Exchange, error) {
	if value == "" {
		return "", ErrEmptyExchange
	}

	normalized := strings.ToUpper(strings.TrimSpace(value))
	e := Exchange(normalized)

	switch e {
	case ExchangeHOSE, ExchangeHNX, ExchangeUPCOM:
		return e, nil
	default:
		return "", ErrInvalidExchange
	}
}

// AllExchanges returns all valid exchanges.
func AllExchanges() []Exchange {
	return []Exchange{ExchangeHOSE, ExchangeHNX, ExchangeUPCOM}
}

// Contains checks if the exchange is in the provided list.
func Contains(exchange Exchange, list []string) bool {
	for _, item := range list {
		if string(exchange) == item {
			return true
		}
	}
	return false
}
