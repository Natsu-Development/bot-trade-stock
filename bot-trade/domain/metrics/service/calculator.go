// Package service provides stock metrics calculation service.
package service

import (
	"math"
	"sort"

	metricsagg "bot-trade/domain/metrics/aggregate"
	periodvo "bot-trade/domain/metrics/valueobject"
	marketvo "bot-trade/domain/shared/valueobject/market"
	indicatorsvc "bot-trade/domain/shared/service"
)

// Calculator calculates stock metrics including RS ratings.
type Calculator struct{}

// NewCalculator creates a new stock metrics calculator.
func NewCalculator() *Calculator {
	return &Calculator{}
}

// periodConfig defines ranking configuration for a single period.
type periodConfig struct {
	getValue      func(*metricsagg.StockMetrics) float64
	hasData       func(*metricsagg.StockMetrics) bool
	setPercentile func(*metricsagg.StockMetrics, int)
}

// periodRankingConfigs defines all periods to rank.
var periodRankingConfigs = []periodConfig{
	{
		getValue:      func(s *metricsagg.StockMetrics) float64 { return s.PeriodReturns.P1 },
		hasData:       func(s *metricsagg.StockMetrics) bool { return s.PeriodReturns.P1 != 0 },
		setPercentile: func(s *metricsagg.StockMetrics, p int) { s.RS1M = p },
	},
	{
		getValue:      func(s *metricsagg.StockMetrics) float64 { return s.PeriodReturns.P3 },
		hasData:       func(s *metricsagg.StockMetrics) bool { return s.PeriodReturns.P3 != 0 },
		setPercentile: func(s *metricsagg.StockMetrics, p int) { s.RS3M = p },
	},
	{
		getValue:      func(s *metricsagg.StockMetrics) float64 { return s.PeriodReturns.P6 },
		hasData:       func(s *metricsagg.StockMetrics) bool { return s.PeriodReturns.P6 != 0 },
		setPercentile: func(s *metricsagg.StockMetrics, p int) { s.RS6M = p },
	},
	{
		getValue:      func(s *metricsagg.StockMetrics) float64 { return s.PeriodReturns.P9 },
		hasData:       func(s *metricsagg.StockMetrics) bool { return s.PeriodReturns.P9 != 0 },
		setPercentile: func(s *metricsagg.StockMetrics, p int) { s.RS9M = p },
	},
	{
		getValue:      func(s *metricsagg.StockMetrics) float64 { return s.PeriodReturns.P12 },
		hasData:       func(s *metricsagg.StockMetrics) bool { return s.PeriodReturns.P12 != 0 },
		setPercentile: func(s *metricsagg.StockMetrics, p int) { s.RS52W = p },
	},
}

// CalculateForStock computes the metrics for a single stock from price history.
// Returns nil if there is insufficient data (less than MinDataPoints).
// Calculates partial RS for periods with enough data, sets 0 for periods without enough data.
// Percentile ratings are assigned later in RankAll based on relative position.
func (c *Calculator) CalculateForStock(symbol, exchange string, priceHistory []marketvo.MarketData) *metricsagg.StockMetrics {
	n := len(priceHistory)

	if n < periodvo.MinDataPoints {
		return nil
	}

	// Parse and validate exchange
	exch, err := marketvo.NewExchange(exchange)
	if err != nil {
		return nil // Invalid exchange, skip this stock
	}

	metrics := &metricsagg.StockMetrics{
		Symbol:   marketvo.Symbol(symbol),
		Exchange: exch,
	}

	// Calculate cumulative returns (from period start to today)
	// Data is assumed to be sorted oldest to newest
	todayPrice := priceHistory[n-1].Close

	// Calculate each period only if enough data is available
	if n >= periodvo.Period1M.TradingDays {
		price1M := priceHistory[n-periodvo.Period1M.TradingDays].Close
		metrics.PeriodReturns.P1 = roundTo4Decimals(priceRatio(price1M, todayPrice))
	}

	if n >= periodvo.Period3M.TradingDays {
		price3M := priceHistory[n-periodvo.Period3M.TradingDays].Close
		metrics.PeriodReturns.P3 = roundTo4Decimals(priceRatio(price3M, todayPrice))
	}

	if n >= periodvo.Period6M.TradingDays {
		price6M := priceHistory[n-periodvo.Period6M.TradingDays].Close
		metrics.PeriodReturns.P6 = roundTo4Decimals(priceRatio(price6M, todayPrice))
	}

	if n >= periodvo.Period9M.TradingDays {
		price9M := priceHistory[n-periodvo.Period9M.TradingDays].Close
		metrics.PeriodReturns.P9 = roundTo4Decimals(priceRatio(price9M, todayPrice))
	}

	if n >= periodvo.Period52W.TradingDays {
		price12M := priceHistory[n-periodvo.Period52W.TradingDays].Close
		metrics.PeriodReturns.P12 = roundTo4Decimals(priceRatio(price12M, todayPrice))
	}

	// Calculate volume metrics
	metrics.CurrentVolume, metrics.VolumeSMA20 = c.calculateVolumeSMA20(priceHistory)

	// Calculate price metrics
	metrics.CurrentPrice = priceHistory[n-1].Close
	if n >= 2 {
		prevClose := priceHistory[n-2].Close
		if prevClose > 0 {
			metrics.PriceChangePct = roundTo4Decimals((metrics.CurrentPrice - prevClose) / prevClose * 100)
		}
	}

	// Calculate moving averages
	metrics.EMA9 = indicatorsvc.CalculateEMA(priceHistory, 9)
	metrics.EMA21 = indicatorsvc.CalculateEMA(priceHistory, 21)
	metrics.EMA50 = indicatorsvc.CalculateEMA(priceHistory, 50)
	metrics.SMA200 = indicatorsvc.CalculateSMA(priceHistory, 200)

	return metrics
}

// calculateVolumeSMA20 calculates the current volume and 20-day SMA of volume.
func (c *Calculator) calculateVolumeSMA20(priceHistory []marketvo.MarketData) (currentVolume, sma20 int64) {
	n := len(priceHistory)
	if n == 0 {
		return 0, 0
	}

	// Current volume is the last day's volume
	currentVolume = priceHistory[n-1].Volume

	// Calculate SMA20 if we have enough data
	if n < periodvo.VolumeSMAPeriod {
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
	startIdx := n - periodvo.VolumeSMAPeriod - 1 // Start from 21 days ago
	if startIdx < 0 {
		startIdx = 0
	}
	endIdx := n - 1 // Up to (but not including) today

	count := 0
	for i := startIdx; i < endIdx && count < periodvo.VolumeSMAPeriod; i++ {
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
func (c *Calculator) RankAll(metrics []*metricsagg.StockMetrics) []*metricsagg.StockMetrics {
	if len(metrics) == 0 {
		return metrics
	}

	// Rank by each period using configuration
	for _, cfg := range periodRankingConfigs {
		rankByFieldFiltered(metrics, cfg.getValue, cfg.hasData, cfg.setPercentile)
	}

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
	metrics []*metricsagg.StockMetrics,
	getValue func(*metricsagg.StockMetrics) float64,
	hasData func(*metricsagg.StockMetrics) bool,
	setPercentile func(*metricsagg.StockMetrics, int),
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
