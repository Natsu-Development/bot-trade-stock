// Package dto provides data transfer objects for the application layer.
// These are not domain objects - they coordinate multiple domain results for use case responses.
package dto

import (
	"time"

	analysisvo "bot-trade/domain/analysis/valueobject"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// AnalysisResult is the unified application DTO for analysis responses.
// Plain data structure - no behavior, just data.
// Contains all analysis outputs from domain services.
// JSON tags are included for direct API marshaling.
type AnalysisResult struct {
	Symbol           string        `json:"symbol"`
	ProcessingTimeMs int64         `json:"processing_time_ms"`
	Timestamp        time.Time     `json:"timestamp"`

	// Combined divergences (both bullish and bearish) with type field
	Divergences []DivergenceDTO `json:"divergences"`

	// Trendlines with computed data points
	Trendlines []TrendlineDTO `json:"trendlines"`

	// Trading signals (DTO with JSON tags)
	Signals []SignalDTO `json:"signals"`

	// Price history for chart rendering (DTO with JSON tags)
	PriceHistory []MarketDataDTO `json:"price_history"`
}

// DivergenceDTO represents a detected divergence pattern for JSON marshaling.
// Combines both bullish and bearish divergences with a type field.
type DivergenceDTO struct {
	Type    string      `json:"type"`
	IsEarly bool        `json:"is_early"`
	Points  []PivotPoint `json:"divergence_points"`
}

// PivotPoint represents a pivot point used in divergence detection.
type PivotPoint struct {
	Price float64 `json:"price"`
	Date  string  `json:"date"`
}

// TrendlineDTO represents a detected trendline with computed data points.
type TrendlineDTO struct {
	Type       string     `json:"type"`
	DataPoints []DataPoint `json:"data_points"`
	StartPrice float64    `json:"start_price"`
	EndPrice   float64    `json:"end_price"`
	StartDate  string     `json:"start_date"`
	EndDate    string     `json:"end_date"`
	Slope      float64    `json:"slope"`
}

// DataPoint represents a single point on a trendline.
type DataPoint struct {
	Date  string  `json:"date"`
	Price float64 `json:"price"`
}

// SignalDTO represents a trading signal for JSON marshaling.
type SignalDTO struct {
	Type   string  `json:"type"`
	Price  float64 `json:"price"`
	Time   string  `json:"time"`
	PriceLine float64 `json:"price_line"`
}

// MarketDataDTO represents OHLCV data for JSON marshaling.
type MarketDataDTO struct {
	Index  int     `json:"index"`
	Date   string  `json:"date"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume int64   `json:"volume"`
	RSI    float64 `json:"rsi"`
}

// ToDivergenceDTOs converts a slice of domain Divergences to DivergenceDTOs.
func ToDivergenceDTOs(divs []analysisvo.Divergence) []DivergenceDTO {
	result := make([]DivergenceDTO, len(divs))
	for i, div := range divs {
		result[i] = DivergenceDTO{
			Type:    string(div.Type),
			IsEarly: div.IsEarly,
			Points: []PivotPoint{
				{Price: div.FirstPivot.Close, Date: div.FirstPivot.Date},
				{Price: div.SecondPivot.Close, Date: div.SecondPivot.Date},
			},
		}
	}
	return result
}

// ToTrendlineDTOs converts a slice of domain Trendlines to TrendlineDTOs.
func ToTrendlineDTOs(priceHistory []marketvo.MarketData, tls []analysisvo.Trendline) []TrendlineDTO {
	result := make([]TrendlineDTO, len(tls))
	for i, tl := range tls {
		domainPoints := tl.DataPoints(priceHistory)
		dataPoints := make([]DataPoint, len(domainPoints))		
		for i, p := range domainPoints {
			dataPoints[i] = DataPoint{
				Date:  p.Date,
				Price: p.Price,
			}
		}
		result[i] = TrendlineDTO{
			Type:       string(tl.Type),
			DataPoints: dataPoints,
			StartPrice: tl.StartPrice(),
			EndPrice:   tl.EndPrice(),
			StartDate:  tl.StartPivot.Date,
			EndDate:    tl.EndPivot.Date,
			Slope:      tl.Slope,
		}
	}
	return result
}

// ToSignalDTOs converts a slice of domain Signals to SignalDTOs.
func ToSignalDTOs(signals []analysisvo.Signal) []SignalDTO {
	result := make([]SignalDTO, len(signals))
	for i, s := range signals {
		result[i] = SignalDTO{
			Type:   string(s.Type),
			Price:  s.Price,
			Time:   s.Time,
			PriceLine: s.PriceLine,
		}
	}
	return result
}

// ToMarketDataDTOs converts a slice of domain MarketData to MarketDataDTOs.
func ToMarketDataDTOs(data []marketvo.MarketData) []MarketDataDTO {
	result := make([]MarketDataDTO, len(data))
	for i, d := range data {
		result[i] = MarketDataDTO{
			Index:  d.Index,
			Date:   d.Date,
			Open:   d.Open,
			High:   d.High,
			Low:    d.Low,
			Close:  d.Close,
			Volume: d.Volume,
			RSI:    d.RSI,
		}
	}
	return result
}
