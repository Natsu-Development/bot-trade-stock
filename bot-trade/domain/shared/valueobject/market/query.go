package market

import (
	"errors"
	"fmt"
	"time"
)

const (
	minDateRangeDays = 1   // Minimum required lookback window
	maxDateRangeDays = 400 // Hard cap to prevent excessively large requests
)

// MarketDataQuery is a value object for market data query parameters.
// It has no identity and is immutable after creation.
type MarketDataQuery struct {
	Symbol    Symbol
	StartDate string
	EndDate   string
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
	normalizedStart, normalizedEnd, err := calculateDateRange(endDate, lookbackDay)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid date range: %w", err)
	}

	return MarketDataQuery{
		Symbol:    symbol,
		StartDate: normalizedStart,
		EndDate:   normalizedEnd,
		Interval:  interval,
	}, nil
}

// calculateDateRange validates endDate and calculates startDate from lookbackDay.
func calculateDateRange(endDate string, lookbackDay LookbackDay) (string, string, error) {
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	parsedEndDate, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return "", "", fmt.Errorf("invalid end_date format '%s': must be YYYY-MM-DD", endDate)
	}

	// Calculate startDate from lookbackDay
	parsedStartDate := parsedEndDate.AddDate(0, 0, -int(lookbackDay))

	today := time.Now().Truncate(24 * time.Hour)
	if parsedEndDate.After(today) {
		return "", "", errors.New("end_date cannot be in the future")
	}

	if parsedEndDate.Sub(parsedStartDate) > time.Duration(maxDateRangeDays)*24*time.Hour {
		return "", "", fmt.Errorf("date range cannot exceed %d days", maxDateRangeDays)
	}

	return parsedStartDate.Format("2006-01-02"), endDate, nil
}
