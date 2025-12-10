package market

import (
	"errors"
	"time"
)

// PriceData represents individual price point data
type PriceData struct {
	date   string
	close  *Price
	high   *Price
	low    *Price
	volume int64
}

// NewPriceData creates a new PriceData instance with validation.
// It validates that:
// - All prices are non-nil
// - Date is not empty
// - OHLC relationships are valid (High >= Close, High >= Low, Close >= Low)
func NewPriceData(date string, close, high, low *Price, volume int64) (*PriceData, error) {
	// Validate required fields
	if date == "" {
		return nil, errors.New("date cannot be empty")
	}

	if close == nil {
		return nil, errors.New("close price cannot be nil")
	}

	if high == nil {
		return nil, errors.New("high price cannot be nil")
	}

	if low == nil {
		return nil, errors.New("low price cannot be nil")
	}

	// Validate OHLC relationships
	// High should be >= Close
	if high.Value() < close.Value() {
		return nil, errors.New("high price must be greater than or equal to close price")
	}

	// High should be >= Low
	if high.Value() < low.Value() {
		return nil, errors.New("high price must be greater than or equal to low price")
	}

	// Close should be >= Low
	if close.Value() < low.Value() {
		return nil, errors.New("close price must be greater than or equal to low price")
	}

	return &PriceData{
		date:   date,
		close:  close,
		high:   high,
		low:    low,
		volume: volume,
	}, nil
}

// Date returns the trading date
func (pd *PriceData) Date() string {
	return pd.date
}

// Close returns the closing price
func (pd *PriceData) Close() *Price {
	return pd.close
}

// High returns the high price
func (pd *PriceData) High() *Price {
	return pd.high
}

// Low returns the low price
func (pd *PriceData) Low() *Price {
	return pd.low
}

// Volume returns the trading volume
func (pd *PriceData) Volume() int64 {
	return pd.volume
}

// PriceRange calculates the price range (High - Low)
func (pd *PriceData) PriceRange() float64 {
	return pd.high.Value() - pd.low.Value()
}

// IsUpDay checks if it was an up day (close > open, using previous close as proxy)
func (pd *PriceData) IsUpDay(previousClose *Price) bool {
	if previousClose == nil {
		return false
	}
	return pd.close.Value() > previousClose.Value()
}

// ParseDate returns the date as time.Time
func (pd *PriceData) ParseDate() (time.Time, error) {
	return time.Parse("2006-01-02", pd.date)
}

// IsValidData checks if the price data is valid
func (pd *PriceData) IsValidData() bool {
	if pd.close == nil || pd.high == nil || pd.low == nil {
		return false
	}

	// High should be >= Close and Low
	// Close should be >= Low
	return pd.high.Value() >= pd.close.Value() &&
		pd.high.Value() >= pd.low.Value() &&
		pd.close.Value() >= pd.low.Value()
}
