package market

import (
	"time"
)

// Volume and volatility thresholds for market analysis
const (
	HighVolumeThreshold     = 2.0 // Volume ratio >= 2.0 indicates high volume
	GoodVolumeThreshold     = 1.5 // Volume ratio >= 1.5 indicates good support
	NormalVolumeThreshold   = 0.8 // Volume ratio >= 0.8 indicates normal volume
	HighVolatilityThreshold = 5.0 // Price volatility >= 5.0 indicates high volatility
)

// MarketData represents current market information
type MarketData struct {
	symbol             string
	latestPrice        *Price
	priceChange        float64
	priceChangePercent float64
	currentVolume      int64
	volumeRatio        float64
	priceVolatility    float64
	tradingDate        string
	timestamp          time.Time
}

// NewMarketData creates a new MarketData instance
func NewMarketData(
	symbol string,
	latestPrice *Price,
	priceChange, priceChangePercent float64,
	currentVolume int64,
	volumeRatio, priceVolatility float64,
	tradingDate string,
) *MarketData {
	return &MarketData{
		symbol:             symbol,
		latestPrice:        latestPrice,
		priceChange:        priceChange,
		priceChangePercent: priceChangePercent,
		currentVolume:      currentVolume,
		volumeRatio:        volumeRatio,
		priceVolatility:    priceVolatility,
		tradingDate:        tradingDate,
		timestamp:          time.Now(),
	}
}

// Symbol returns the market data symbol
func (md *MarketData) Symbol() string {
	return md.symbol
}

// LatestPrice returns the latest price
func (md *MarketData) LatestPrice() *Price {
	return md.latestPrice
}

// PriceChange returns the price change
func (md *MarketData) PriceChange() float64 {
	return md.priceChange
}

// PriceChangePercent returns the price change percentage
func (md *MarketData) PriceChangePercent() float64 {
	return md.priceChangePercent
}

// CurrentVolume returns the current volume
func (md *MarketData) CurrentVolume() int64 {
	return md.currentVolume
}

// VolumeRatio returns the volume ratio
func (md *MarketData) VolumeRatio() float64 {
	return md.volumeRatio
}

// PriceVolatility returns the price volatility
func (md *MarketData) PriceVolatility() float64 {
	return md.priceVolatility
}

// TradingDate returns the trading date
func (md *MarketData) TradingDate() string {
	return md.tradingDate
}

// Timestamp returns when this data was created
func (md *MarketData) Timestamp() time.Time {
	return md.timestamp
}

// IsHighVolume checks if volume is significantly higher than average
func (md *MarketData) IsHighVolume() bool {
	return md.volumeRatio >= HighVolumeThreshold
}

// IsHighVolatility checks if price volatility is high
func (md *MarketData) IsHighVolatility() bool {
	return md.priceVolatility >= HighVolatilityThreshold
}

// VolumeConfirmation returns volume confirmation status
func (md *MarketData) VolumeConfirmation() string {
	switch {
	case md.volumeRatio >= HighVolumeThreshold:
		return "high_volume_confirmation"
	case md.volumeRatio >= GoodVolumeThreshold:
		return "good_volume_support"
	case md.volumeRatio >= NormalVolumeThreshold:
		return "normal_volume"
	default:
		return "low_volume_warning"
	}
}
