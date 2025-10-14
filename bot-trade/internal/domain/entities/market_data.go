package entities

import (
	"time"

	"bot-trade/internal/domain/valueobjects"
)

// MarketData represents current market information
type MarketData struct {
	symbol             string
	latestPrice        *valueobjects.Price
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
	latestPrice *valueobjects.Price,
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
func (md *MarketData) LatestPrice() *valueobjects.Price {
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
	return md.volumeRatio >= 2.0
}

// IsHighVolatility checks if price volatility is high
func (md *MarketData) IsHighVolatility() bool {
	return md.priceVolatility >= 5.0
}

// VolumeConfirmation returns volume confirmation status
func (md *MarketData) VolumeConfirmation() string {
	switch {
	case md.volumeRatio >= 2.0:
		return "high_volume_confirmation"
	case md.volumeRatio >= 1.5:
		return "good_volume_support"
	case md.volumeRatio >= 0.8:
		return "normal_volume"
	default:
		return "low_volume_warning"
	}
}
