package market

import (
	"errors"
	"math"
)

// PriceData represents individual price point data.
type PriceData struct {
	Date  string
	Close float64
}

// NewPriceData creates a new PriceData with validation.
func NewPriceData(date string, close float64) (*PriceData, error) {
	if date == "" {
		return nil, errors.New("date cannot be empty")
	}

	if close < 0 {
		return nil, errors.New("close price cannot be negative")
	}

	if math.IsNaN(close) || math.IsInf(close, 0) {
		return nil, errors.New("close price must be a valid number")
	}

	return &PriceData{
		Date:  date,
		Close: close,
	}, nil
}

// RawPriceData represents raw price data from external sources.
type RawPriceData struct {
	Date  string
	Close float64
}

// NewPriceHistoryFromRaw creates a slice of PriceData from raw data.
func NewPriceHistoryFromRaw(rawData []RawPriceData) ([]*PriceData, error) {
	priceHistory := make([]*PriceData, len(rawData))

	for i, raw := range rawData {
		priceData, err := NewPriceData(raw.Date, raw.Close)
		if err != nil {
			return nil, err
		}
		priceHistory[i] = priceData
	}

	return priceHistory, nil
}
