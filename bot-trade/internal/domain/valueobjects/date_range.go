package valueobjects

import (
	"errors"
	"fmt"
	"time"
)

// DateRange represents a date range for data retrieval
type DateRange struct {
	startDate time.Time
	endDate   time.Time
}

// NewDateRange creates a new date range with validation
func NewDateRange(startDate, endDate string) (*DateRange, error) {
	// Default end date to today if empty
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	// Parse end date
	parsedEndDate, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, fmt.Errorf("invalid end_date format '%s': must be YYYY-MM-DD", endDate)
	}

	// Default start date if empty (200 days before end date)
	var parsedStartDate time.Time
	if startDate == "" {
		parsedStartDate = parsedEndDate.AddDate(0, 0, -200)
	} else {
		parsedStartDate, err = time.Parse("2006-01-02", startDate)
		if err != nil {
			return nil, fmt.Errorf("invalid start_date format '%s': must be YYYY-MM-DD", startDate)
		}
	}

	// Validate date range
	if parsedStartDate.After(parsedEndDate) {
		return nil, errors.New("start_date cannot be after end_date")
	}

	// Check if end date is not in the future (allow today)
	today := time.Now().Truncate(24 * time.Hour)
	if parsedEndDate.After(today) {
		return nil, errors.New("end_date cannot be in the future")
	}

	// Check maximum range (e.g., 1 year)
	maxDays := 365
	if parsedEndDate.Sub(parsedStartDate) > time.Duration(maxDays)*24*time.Hour {
		return nil, fmt.Errorf("date range cannot exceed %d days", maxDays)
	}

	return &DateRange{
		startDate: parsedStartDate,
		endDate:   parsedEndDate,
	}, nil
}

// StartDate returns the start date
func (dr *DateRange) StartDate() time.Time {
	return dr.startDate
}

// EndDate returns the end date
func (dr *DateRange) EndDate() time.Time {
	return dr.endDate
}

// StartDateString returns start date as string
func (dr *DateRange) StartDateString() string {
	return dr.startDate.Format("2006-01-02")
}

// EndDateString returns end date as string
func (dr *DateRange) EndDateString() string {
	return dr.endDate.Format("2006-01-02")
}

// Duration returns the duration of the date range
func (dr *DateRange) Duration() time.Duration {
	return dr.endDate.Sub(dr.startDate)
}

// DaysCount returns the number of days in the range
func (dr *DateRange) DaysCount() int {
	return int(dr.Duration().Hours() / 24)
}

// Contains checks if a given date is within the range
func (dr *DateRange) Contains(date time.Time) bool {
	return !date.Before(dr.startDate) && !date.After(dr.endDate)
}

// IsValidForTrading checks if the date range is suitable for trading analysis
func (dr *DateRange) IsValidForTrading() bool {
	// Need at least 14 days for RSI calculation
	return dr.DaysCount() >= 14
}

// String returns a string representation of the date range
func (dr *DateRange) String() string {
	return fmt.Sprintf("%s to %s (%d days)",
		dr.StartDateString(),
		dr.EndDateString(),
		dr.DaysCount())
}
