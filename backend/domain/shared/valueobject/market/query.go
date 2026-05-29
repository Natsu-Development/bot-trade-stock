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

// NewMarketDataQueryFromStrings creates a validated MarketDataQuery from raw string values.
// startDate is automatically calculated as (endDate - lookbackDay).
func NewMarketDataQueryFromStrings(symbolStr, endDate, intervalStr string, lookbackDay LookbackDay) (MarketDataQuery, error) {
	symbol, err := NewSymbol(symbolStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid symbol: %w", err)
	}

	interval, err := NewInterval(intervalStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid interval: %w", err)
	}

	// Normalize endDate (defaults to today) and calculate startDate from lookback
	startDate, endDateParsed, err := calculateDateRange(endDate, lookbackDay)
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

// calculateDateRange validates endDate and calculates startDate from lookbackDay.
func calculateDateRange(endDate string, lookbackDay LookbackDay) (time.Time, time.Time, error) {
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	parsedEndDate, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid end_date format '%s': must be YYYY-MM-DD", endDate)
	}

	// Calculate startDate from lookbackDay
	parsedStartDate := parsedEndDate.AddDate(0, 0, -int(lookbackDay))

	today := time.Now().Truncate(24 * time.Hour)
	if parsedEndDate.After(today) {
		return time.Time{}, time.Time{}, errors.New("end_date cannot be in the future")
	}

	if parsedEndDate.Sub(parsedStartDate) > time.Duration(MaxLookbackDay)*24*time.Hour {
		return time.Time{}, time.Time{}, fmt.Errorf("date range cannot exceed %d days", MaxLookbackDay)
	}

	return parsedStartDate, parsedEndDate, nil
}
