package market

import (
	"errors"
	"fmt"
	"time"
)

// MarketDataQuery is a value object for market data query parameters.
// It has no identity and is immutable after creation.
type MarketDataQuery struct {
	Symbol    Symbol
	StartDate time.Time
	EndDate   time.Time
	Interval  Interval
}

// NewMarketDataQuery creates a validated MarketDataQuery from raw string values.
// startDate is automatically calculated as (endDate - fetchSpan).
func NewMarketDataQuery(symbolStr, endDate, intervalStr string, fetchSpan FetchSpanDays) (MarketDataQuery, error) {
	symbol, err := NewSymbol(symbolStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid symbol: %w", err)
	}

	interval, err := NewInterval(intervalStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid interval: %w", err)
	}

	// Normalize endDate (defaults to today) and calculate startDate from the fetch span
	startDate, endDateParsed, err := calculateDateRange(endDate, fetchSpan)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid date range: %w", err)
	}

	return MarketDataQuery{
		Symbol:    symbol,
		StartDate: startDate,
		EndDate:   endDateParsed,
		Interval:  interval,
	}, nil
}

// calculateDateRange validates endDate and calculates startDate from fetchSpan.
func calculateDateRange(endDate string, fetchSpan FetchSpanDays) (time.Time, time.Time, error) {
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	parsedEndDate, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid end_date format '%s': must be YYYY-MM-DD", endDate)
	}

	// Calculate startDate from fetchSpan
	parsedStartDate := parsedEndDate.AddDate(0, 0, -int(fetchSpan))

	today := time.Now().Truncate(24 * time.Hour)
	if parsedEndDate.After(today) {
		return time.Time{}, time.Time{}, errors.New("end_date cannot be in the future")
	}

	return parsedStartDate, parsedEndDate, nil
}
