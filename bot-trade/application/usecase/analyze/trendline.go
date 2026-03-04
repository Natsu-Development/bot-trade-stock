package analyze

import (
	"context"
	"time"

	"bot-trade/domain/aggregate/config"
	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/service/trendline"

	"go.uber.org/zap"
)

// trendlineAnalyzer is internal - not exported.
// Performs ONLY trendline detection (data already prepared by orchestrator).
type trendlineAnalyzer struct {
	logger *zap.Logger
}

func newTrendlineAnalyzer(logger *zap.Logger) *trendlineAnalyzer {
	return &trendlineAnalyzer{logger: logger}
}

// detect performs ONLY trendline detection using pre-sliced price data.
// Returns trading signals, price history, and trendlines for display.
func (ta *trendlineAnalyzer) detect(
	_ context.Context,
	recentPriceHistory []market.MarketData,
	currentPrice float64,
	q market.MarketDataQuery,
	cfg *config.TradingConfig,
) ([]market.TradingSignal, []*market.PriceData, []market.TrendlineDisplay, error) {
	symbol := q.Symbol

	ta.logger.Debug("Trendline detection",
		zap.String("symbol", symbol),
		zap.String("configID", cfg.ID),
	)
	startTime := time.Now()

	detector := trendline.NewDetector(trendline.DefaultTrendlineConfig())

	signalsResult, err := detector.DetectSignals(recentPriceHistory)
	if err != nil {
		return nil, nil, nil, err
	}

	signals := make([]market.TradingSignal, 0, len(signalsResult))
	for _, bs := range signalsResult {
		signal := market.NewTradingSignal(
			symbol,
			bs.Type,
			bs.Price,
			0,
			bs.Message,
			"trendline",
		)
		signal.Time = bs.Time
		signal.Interval = q.Interval

		if bs.Trendline.IsValid {
			startPrice, endPrice := ta.trendlinePivotPrices(bs.Trendline)
			signal.Trendline = &market.TrendlineInfo{
				Type:             bs.Trendline.Type.String(),
				StartPrice:       startPrice,
				EndPrice:         endPrice,
				StartDate:        bs.Trendline.StartPivot.Date,
				EndDate:          bs.Trendline.EndPivot.Date,
				CurrentLinePrice: bs.TrendlinePrice,
				Slope:            bs.Trendline.Slope,
			}
		}

		signals = append(signals, *signal)
	}

	processingTime := time.Since(startTime)
	ta.logger.Debug("Trendline detection completed",
		zap.String("symbol", symbol),
		zap.Duration("duration", processingTime),
		zap.Int("signals_found", len(signals)),
	)

	supportLines, resistanceLines := detector.GetActiveTrendlines(recentPriceHistory)
	trendlines := ta.convertToTrendlineDisplays(supportLines, resistanceLines, recentPriceHistory)

	// Convert MarketData back to PriceData for the API response
	priceHistory := make([]*market.PriceData, len(recentPriceHistory))
	for i, md := range recentPriceHistory {
		priceHistory[i] = &market.PriceData{
			Date:   md.Date,
			Open:   md.Open,
			High:   md.High,
			Low:    md.Low,
			Close:  md.Close,
			Volume: md.Volume,
		}
	}

	return signals, priceHistory, trendlines, nil
}

// trendlinePivotPrices extracts pivot prices from a trendline.
func (ta *trendlineAnalyzer) trendlinePivotPrices(line trendline.Trendline) (startPrice, endPrice float64) {
	if line.Type == trendline.UptrendSupport {
		return line.StartPivot.Low, line.EndPivot.Low
	}
	return line.StartPivot.High, line.EndPivot.High
}

// convertToTrendlineDisplays converts backend trendlines to display format with pre-calculated data points.
func (ta *trendlineAnalyzer) convertToTrendlineDisplays(
	supportLines, resistanceLines []trendline.Trendline,
	priceHistory []market.MarketData,
) []market.TrendlineDisplay {
	trendlines := make([]market.TrendlineDisplay, 0, len(supportLines)+len(resistanceLines))

	for _, line := range supportLines {
		trendlines = append(trendlines, ta.createTrendlineDisplay(line, priceHistory))
	}
	for _, line := range resistanceLines {
		trendlines = append(trendlines, ta.createTrendlineDisplay(line, priceHistory))
	}

	return trendlines
}

// createTrendlineDisplay creates a TrendlineDisplay from a Trendline with pre-calculated data points.
func (ta *trendlineAnalyzer) createTrendlineDisplay(
	line trendline.Trendline,
	priceHistory []market.MarketData,
) market.TrendlineDisplay {
	startPrice, endPrice := ta.trendlinePivotPrices(line)

	dateToIndexMap := make(map[string]int, len(priceHistory))
	for i, p := range priceHistory {
		dateToIndexMap[p.Date] = i
	}

	startDate := line.StartPivot.Date
	endDate := line.EndPivot.Date

	var dataPoints []market.TrendlineDataPoint
	for _, p := range priceHistory {
		if p.Date < startDate {
			continue
		}
		if p.Date > endDate {
			break
		}

		index := dateToIndexMap[p.Date]
		trendlinePrice := line.PriceAt(index)
		dataPoints = append(dataPoints, market.TrendlineDataPoint{
			Date:  p.Date,
			Price: trendlinePrice,
		})
	}

	return market.TrendlineDisplay{
		Type:       line.Type.String(),
		DataPoints: dataPoints,
		StartPrice: startPrice,
		EndPrice:   endPrice,
		StartDate:  line.StartPivot.Date,
		EndDate:    line.EndPivot.Date,
		Slope:      line.Slope,
	}
}
