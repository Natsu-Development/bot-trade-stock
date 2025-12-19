package market

import (
	"errors"
	"fmt"
	"time"
)

// MarketDataQuery is the aggregate root for market data query parameters.
type MarketDataQuery struct {
	Symbol    string
	StartDate string
	EndDate   string
	Interval  string
}

// NewMarketDataQueryFromStrings creates a validated MarketDataQuery from raw string values.
func NewMarketDataQueryFromStrings(symbolStr, startDate, endDate, intervalStr string) (MarketDataQuery, error) {
	symbol, err := NewSymbol(symbolStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid symbol: %w", err)
	}

	interval, err := NewInterval(intervalStr)
	if err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid interval: %w", err)
	}

	if err := validateDateRange(startDate, endDate); err != nil {
		return MarketDataQuery{}, fmt.Errorf("invalid date range: %w", err)
	}

	return MarketDataQuery{
		Symbol:    symbol.String(),
		StartDate: startDate,
		EndDate:   endDate,
		Interval:  interval.String(),
	}, nil
}

// validateDateRange validates start and end dates.
func validateDateRange(startDate, endDate string) error {
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

