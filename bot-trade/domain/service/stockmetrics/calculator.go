// Package stockmetrics provides stock metrics calculation service.
package stockmetrics

import (
	"math"
	"sort"

	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/aggregate/stockmetrics"
)

const (
	// Trading days for cumulative period calculations
	TradingDays1M  = 21  // ~1 month
	TradingDays3M  = 63  // ~3 months
	TradingDays6M  = 126 // ~6 months
	TradingDays9M  = 189 // ~9 months
	TradingDays12M = 252 // ~12 months (52 weeks)

	// Volume SMA period
	VolumeSMAPeriod = 20 // 20-day SMA for volume

	// MinDataPoints is the minimum required data points for calculation.
	// Lowered to 21 to allow partial RS calculation for newer stocks.
	MinDataPoints = 21 // Minimum 1 month of trading data
)

// Calculator calculates stock metrics including RS ratings.
type Calculator struct{}

// NewCalculator creates a new stock metrics calculator.
func NewCalculator() *Calculator {
	return &Calculator{}
}

// CalculateForStock computes the metrics for a single stock from price history.
// Returns nil if there is insufficient data (less than MinDataPoints = 21 days).
// Calculates partial RS for periods with enough data, sets 0 for periods without enough data.
// Percentile ratings are assigned later in RankAll based on relative position.
func (c *Calculator) CalculateForStock(symbol, exchange string, priceHistory []*market.PriceData) *stockmetrics.StockMetrics {
	n := len(priceHistory)

	if n < MinDataPoints {
		return nil
	}

	metrics := &stockmetrics.StockMetrics{
		Symbol:   symbol,
		Exchange: exchange,
	}

	// Calculate cumulative returns (from period start to today)
	// Data is assumed to be sorted oldest to newest
	todayPrice := priceHistory[n-1].Close

	// Calculate each period only if enough data is available
	if n >= TradingDays1M {
		price1M := priceHistory[n-TradingDays1M].Close
		metrics.PeriodReturns.P1 = roundTo4Decimals(priceRatio(price1M, todayPrice))
	}

	if n >= TradingDays3M {
		price3M := priceHistory[n-TradingDays3M].Close
		metrics.PeriodReturns.P3 = roundTo4Decimals(priceRatio(price3M, todayPrice))
	}

	if n >= TradingDays6M {
		price6M := priceHistory[n-TradingDays6M].Close
		metrics.PeriodReturns.P6 = roundTo4Decimals(priceRatio(price6M, todayPrice))
	}

	if n >= TradingDays9M {
		price9M := priceHistory[n-TradingDays9M].Close
		metrics.PeriodReturns.P9 = roundTo4Decimals(priceRatio(price9M, todayPrice))
	}

	if n >= TradingDays12M {
		price12M := priceHistory[n-TradingDays12M].Close
		metrics.PeriodReturns.P12 = roundTo4Decimals(priceRatio(price12M, todayPrice))
	}

	// Calculate volume metrics
	metrics.CurrentVolume, metrics.VolumeSMA20 = c.calculateVolumeSMA20(priceHistory)

	return metrics
}

// calculateVolumeSMA20 calculates the current volume and 20-day SMA of volume.
func (c *Calculator) calculateVolumeSMA20(priceHistory []*market.PriceData) (currentVolume, sma20 int64) {
	n := len(priceHistory)
	if n == 0 {
		return 0, 0
	}

	// Current volume is the last day's volume
	currentVolume = priceHistory[n-1].Volume

	// Calculate SMA20 if we have enough data
	if n < VolumeSMAPeriod {
		// Not enough data for SMA20, use average of available data
		var sum int64
		for _, p := range priceHistory {
			sum += p.Volume
		}
		sma20 = sum / int64(n)
		return currentVolume, sma20
	}

	// Calculate 20-day SMA (last 20 days, excluding today for proper comparison)
	var sum int64
	startIdx := n - VolumeSMAPeriod - 1 // Start from 21 days ago
	if startIdx < 0 {
		startIdx = 0
	}
	endIdx := n - 1 // Up to (but not including) today

	count := 0
	for i := startIdx; i < endIdx && count < VolumeSMAPeriod; i++ {
		sum += priceHistory[i].Volume
		count++
	}

	if count > 0 {
		sma20 = sum / int64(count)
	}

	return currentVolume, sma20
}

// RankAll assigns percentile ratings (1-99) based on relative position among all stocks.
// Higher price ratio = better rank = higher percentile.
// Stocks without enough data for a period (return = 0) get RS = 0 for that period.
// Returns the metrics sorted by RS52W (best first), then by RS1M for stocks without RS52W.
func (c *Calculator) RankAll(metrics []*stockmetrics.StockMetrics) []*stockmetrics.StockMetrics {
	if len(metrics) == 0 {
		return metrics
	}

	// Rank by each period using relative position
	// Only rank stocks that have data for that period (non-zero return)
	rankByFieldFiltered(metrics,
		func(s *stockmetrics.StockMetrics) float64 { return s.PeriodReturns.P1 },
		func(s *stockmetrics.StockMetrics) bool { return s.PeriodReturns.P1 != 0 },
		func(s *stockmetrics.StockMetrics, p int) { s.RS1M = p })

	rankByFieldFiltered(metrics,
		func(s *stockmetrics.StockMetrics) float64 { return s.PeriodReturns.P3 },
		func(s *stockmetrics.StockMetrics) bool { return s.PeriodReturns.P3 != 0 },
		func(s *stockmetrics.StockMetrics, p int) { s.RS3M = p })

	rankByFieldFiltered(metrics,
		func(s *stockmetrics.StockMetrics) float64 { return s.PeriodReturns.P6 },
		func(s *stockmetrics.StockMetrics) bool { return s.PeriodReturns.P6 != 0 },
		func(s *stockmetrics.StockMetrics, p int) { s.RS6M = p })

	rankByFieldFiltered(metrics,
		func(s *stockmetrics.StockMetrics) float64 { return s.PeriodReturns.P9 },
		func(s *stockmetrics.StockMetrics) bool { return s.PeriodReturns.P9 != 0 },
		func(s *stockmetrics.StockMetrics, p int) { s.RS9M = p })

	// RS52W uses P12 (52 weeks = 252 trading days)
	rankByFieldFiltered(metrics,
		func(s *stockmetrics.StockMetrics) float64 { return s.PeriodReturns.P12 },
		func(s *stockmetrics.StockMetrics) bool { return s.PeriodReturns.P12 != 0 },
		func(s *stockmetrics.StockMetrics, p int) { s.RS52W = p })

	// Sort by RS52W for final output (best first)
	// For stocks without RS52W (0), sort by RS1M as fallback
	sort.Slice(metrics, func(i, j int) bool {
		if metrics[i].RS52W != metrics[j].RS52W {
			return metrics[i].RS52W > metrics[j].RS52W
		}
		return metrics[i].RS1M > metrics[j].RS1M
	})

	return metrics
}

// rankByFieldFiltered assigns percentile ratings based on relative position.
// Only ranks stocks that pass the hasData filter. Stocks without data get 0.
// Formula: percentile = 99 - (rank / total) * 98
// Top stock gets 99, bottom gets 1.
func rankByFieldFiltered(
	metrics []*stockmetrics.StockMetrics,
	getValue func(*stockmetrics.StockMetrics) float64,
	hasData func(*stockmetrics.StockMetrics) bool,
	setPercentile func(*stockmetrics.StockMetrics, int),
) {
	// Filter to only stocks with data for this period
	var validIndices []int
	for i, s := range metrics {
		if hasData(s) {
			validIndices = append(validIndices, i)
		} else {
			// No data for this period, set to 0
			setPercentile(s, 0)
		}
	}

	if len(validIndices) == 0 {
		return
	}

	totalStocks := len(validIndices)

	// Sort valid indices by value descending (higher = better)
	sort.Slice(validIndices, func(i, j int) bool {
		return getValue(metrics[validIndices[i]]) > getValue(metrics[validIndices[j]])
	})

	// Assign percentile ratings based on rank position
	for rank, idx := range validIndices {
		var percentile int
		if totalStocks == 1 {
			percentile = 99
		} else {
			// percentile = 99 - (rank / total) * 98
			// Rank 0 → 99, Rank (total-1) → 1
			percentile = 99 - int(float64(rank)*98/float64(totalStocks-1))
		}

		// Ensure bounds
		if percentile > 99 {
			percentile = 99
		}
		if percentile < 1 {
			percentile = 1
		}

		setPercentile(metrics[idx], percentile)
	}
}

// priceRatio computes the price ratio between end and start prices.
// Returns 1.73 for 73% gain from start to end.
func priceRatio(startPrice, endPrice float64) float64 {
	if startPrice == 0 {
		return 1 // neutral ratio if no start price
	}
	return endPrice / startPrice
}

// roundTo4Decimals rounds a float to 4 decimal places.
func roundTo4Decimals(val float64) float64 {
	return math.Round(val*10000) / 10000
}
