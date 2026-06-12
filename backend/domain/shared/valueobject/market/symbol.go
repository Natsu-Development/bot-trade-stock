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

// equitySymbolRe matches symbols a market-data provider will serve OHLCV for:
//   - 3-4 letter cash equity tickers (VIC, VCB, HPG, VJC, FRT, ...)
//   - ETF tickers with the E1/FUE prefix (E1VFVN30, FUEVFVND, ...)
//
// Warrants (CFPT2311), bonds (BVBS17094), TD-codes, and other derivatives
// contain digits or exceed 4 chars and are excluded — no provider serves them.
var equitySymbolRe = regexp.MustCompile(`^([A-Z]{3,4}|E1[A-Z0-9]+|FUE[A-Z0-9]+)$`)

// IsEquity reports whether the symbol is a cash equity or ETF ticker (the kinds a
// provider serves OHLCV for), excluding warrants, bonds, TD-codes and other
// derivatives.
func (s Symbol) IsEquity() bool {
	return equitySymbolRe.MatchString(string(s))
}

// StockInfo represents basic information about a stock.
// This is a value object with no identity.
type StockInfo struct {
	Symbol   Symbol
	Exchange Exchange
	Name     string
}
