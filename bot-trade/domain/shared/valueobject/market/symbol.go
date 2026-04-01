// Package market provides shared immutable value objects for market and trading bounded contexts.
// This is part of the Shared Kernel pattern - explicitly shared model elements that
// all contexts agree on and use consistently.
package market

import (
	"errors"
	"regexp"
	"strings"
)

var ErrInvalidSymbol = errors.New("symbol must be between 2 and 10 alphanumeric characters")

type Symbol string

var symbolRegex = regexp.MustCompile(`^[A-Z0-9]+$`)

func NewSymbol(value string) (Symbol, error) {
	if value == "" {
		return "", ErrInvalidSymbol
	}
	value = strings.ToUpper(strings.TrimSpace(value))
	if len(value) < 2 || len(value) > 10 || !symbolRegex.MatchString(value) {
		return "", ErrInvalidSymbol
	}
	return Symbol(value), nil
}

// StockInfo represents basic information about a stock.
// This is a value object with no identity.
type StockInfo struct {
	Symbol   Symbol
	Exchange Exchange
	Name     string
}
