// Package market provides market-related value objects shared across all bounded contexts.
package market

// MarketData represents complete OHLCV data with Index and optional RSI.
// Index is 0-based position in the data array.
// RSI is 0 if not calculated yet.
// This is a value object - immutable data record shared across all bounded contexts.
type MarketData struct {
	Index  int
	Date   string
	Open   float64
	High   float64
	Low    float64
	Close  float64
	Volume int64
	RSI    float64
}

// WithRSI returns a copy of MarketData with RSI set.
func (m MarketData) WithRSI(rsi float64) MarketData {
	m.RSI = rsi
	return m
}

// HasRSI returns true if RSI has been calculated (non-zero).
func (m MarketData) HasRSI() bool {
	return m.RSI != 0
}

// IsValid returns true if OHLC data is valid.
func (m MarketData) IsValid() bool {
	return m.High >= m.Low &&
		m.Close >= m.Low &&
		m.Close <= m.High &&
		m.Open >= m.Low &&
		m.Open <= m.High &&
		m.High > 0 &&
		m.Low > 0
}
