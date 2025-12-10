package market

import (
	"errors"
	"fmt"
)

// MarketDataQuery is a value object for market data query parameters.
// It encapsulates the parameters needed to request market data from a repository.
type MarketDataQuery struct {
	symbol    Symbol
	startDate string
	endDate   string
	interval  Interval
}

// NewMarketDataQuery creates a validated MarketDataQuery.
// All components must be valid and non-nil.
func NewMarketDataQuery(symbol *Symbol, startDate, endDate string, interval *Interval) (MarketDataQuery, error) {
	if symbol == nil {
		return MarketDataQuery{}, errors.New("symbol cannot be nil")
	}
	if interval == nil {
		return MarketDataQuery{}, errors.New("interval cannot be nil")
	}

	// Validate dates if provided (DateRange validates format)
	if startDate != "" || endDate != "" {
		_, err := NewDateRange(startDate, endDate)
		if err != nil {
			return MarketDataQuery{}, fmt.Errorf("invalid date range: %w", err)
		}
	}

	return MarketDataQuery{
		symbol:    *symbol,
		startDate: startDate,
		endDate:   endDate,
		interval:  *interval,
	}, nil
}

// NewMarketDataQueryFromStrings creates a MarketDataQuery from raw string values.
// This is a convenience factory that handles validation of all components.
func NewMarketDataQueryFromStrings(symbolStr, startDate, endDate, intervalStr string) (MarketDataQuery, error) {
	symbol, err := NewSymbol(symbolStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid symbol: %w", err)
	}

	interval, err := NewDataInterval(intervalStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid interval: %w", err)
	}

	return NewMarketDataQuery(symbol, startDate, endDate, interval)
}

// Symbol returns the stock symbol.
func (q MarketDataQuery) Symbol() Symbol {
	return q.symbol
}

// SymbolString returns the stock symbol as a string.
func (q MarketDataQuery) SymbolString() string {
	return q.symbol.Value()
}

// StartDate returns the start date string.
func (q MarketDataQuery) StartDate() string {
	return q.startDate
}

// EndDate returns the end date string.
func (q MarketDataQuery) EndDate() string {
	return q.endDate
}

// Interval returns the data interval.
func (q MarketDataQuery) Interval() Interval {
	return q.interval
}

// IntervalString returns the interval as a string.
func (q MarketDataQuery) IntervalString() string {
	return q.interval.Value()
}

// Equals checks if two MarketDataQuery values are equal.
func (q MarketDataQuery) Equals(other MarketDataQuery) bool {
	return q.symbol.Equals(&other.symbol) &&
		q.startDate == other.startDate &&
		q.endDate == other.endDate &&
		q.interval.Value() == other.interval.Value()
}

// String returns a string representation of the query.
func (q MarketDataQuery) String() string {
	return fmt.Sprintf("MarketDataQuery{symbol: %s, startDate: %s, endDate: %s, interval: %s}",
		q.symbol.Value(), q.startDate, q.endDate, q.interval.Value())
}
