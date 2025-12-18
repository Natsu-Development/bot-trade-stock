package market

import (
	"errors"
	"fmt"
	"time"
)

// MarketDataQuery is the aggregate root for market data query parameters.
type MarketDataQuery struct {
	symbol    Symbol
	startDate string
	endDate   string
	interval  Interval
}

// NewMarketDataQuery creates a validated MarketDataQuery.
func NewMarketDataQuery(symbol Symbol, startDate, endDate string, interval Interval) (MarketDataQuery, error) {
	if symbol == "" {
		return MarketDataQuery{}, errors.New("symbol cannot be empty")
	}
	if interval == "" {
		return MarketDataQuery{}, errors.New("interval cannot be empty")
	}

	if err := validateDateRange(startDate, endDate); err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid date range: %w", err)
	}

	return MarketDataQuery{
		symbol:    symbol,
		startDate: startDate,
		endDate:   endDate,
		interval:  interval,
	}, nil
}

// NewMarketDataQueryFromStrings creates a MarketDataQuery from raw string values.
func NewMarketDataQueryFromStrings(symbolStr, startDate, endDate, intervalStr string) (MarketDataQuery, error) {
	symbol, err := NewSymbol(symbolStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid symbol: %w", err)
	}

	interval, err := NewInterval(intervalStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid interval: %w", err)
	}

	return NewMarketDataQuery(symbol, startDate, endDate, interval)
}

// SymbolString returns the stock symbol as a string.
func (q MarketDataQuery) SymbolString() string {
	return q.symbol.String()
}

// StartDate returns the start date string.
func (q MarketDataQuery) StartDate() string {
	return q.startDate
}

// EndDate returns the end date string.
func (q MarketDataQuery) EndDate() string {
	return q.endDate
}

// IntervalString returns the interval as a string.
func (q MarketDataQuery) IntervalString() string {
	return q.interval.String()
}

// validateDateRange validates start and end dates without creating a separate type.
func validateDateRange(startDate, endDate string) error {
	// Default end date to today if empty
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	parsedEndDate, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return fmt.Errorf("invalid end_date format '%s': must be YYYY-MM-DD", endDate)
	}

	var parsedStartDate time.Time
	if startDate == "" {
		parsedStartDate = parsedEndDate.AddDate(0, 0, -300)
	} else {
		parsedStartDate, err = time.Parse("2006-01-02", startDate)
		if err != nil {
			return fmt.Errorf("invalid start_date format '%s': must be YYYY-MM-DD", startDate)
		}
	}

	if parsedStartDate.After(parsedEndDate) {
		return errors.New("start_date cannot be after end_date")
	}

	today := time.Now().Truncate(24 * time.Hour)
	if parsedEndDate.After(today) {
		return errors.New("end_date cannot be in the future")
	}

	maxDays := 365
	if parsedEndDate.Sub(parsedStartDate) > time.Duration(maxDays)*24*time.Hour {
		return fmt.Errorf("date range cannot exceed %d days", maxDays)
	}

	return nil
}
