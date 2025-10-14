package entities

import (
	"bot-trade/internal/domain/valueobjects"
	"time"
)

// PriceData represents individual price point data
type PriceData struct {
	date   string
	close  *valueobjects.Price
	high   *valueobjects.Price
	low    *valueobjects.Price
	volume int64
}

// NewPriceData creates a new PriceData instance
func NewPriceData(date string, close, high, low *valueobjects.Price, volume int64) *PriceData {
	return &PriceData{
		date:   date,
		close:  close,
		high:   high,
		low:    low,
		volume: volume,
	}
}

// Date returns the trading date
func (pd *PriceData) Date() string {
	return pd.date
}

// Close returns the closing price
func (pd *PriceData) Close() *valueobjects.Price {
	return pd.close
}

// High returns the high price
func (pd *PriceData) High() *valueobjects.Price {
	return pd.high
}

// Low returns the low price
func (pd *PriceData) Low() *valueobjects.Price {
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
func (pd *PriceData) IsUpDay(previousClose *valueobjects.Price) bool {
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
