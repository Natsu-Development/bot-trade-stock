package analyze

import (
	"context"
	"fmt"
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
// Data preparation (fetching, slicing) happens in the orchestrator.
func (ta *trendlineAnalyzer) detect(
	_ context.Context,
	recentPriceHistory []*market.PriceData,
	currentPrice float64,
	q market.MarketDataQuery,
	cfg *config.TradingConfig,
) (*market.SignalAnalysisResult, error) {
	symbol := q.Symbol

	ta.logger.Debug("Trendline detection",
		zap.String("symbol", symbol),
		zap.String("configID", cfg.ID),
	)
	startTime := time.Now()

	detector := trendline.NewDetector(trendline.DefaultTrendlineConfig())

	signalsResult, err := detector.DetectSignals(recentPriceHistory)
	if err != nil {
		return nil, fmt.Errorf("failed to detect signals: %w", err)
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

	result := market.NewSignalAnalysisResult(
		symbol,
		signals,
		processingTime.Milliseconds(),
		q.StartDate,
		q.EndDate,
		q.Interval,
		currentPrice,
		0,
	)
	result.SetPriceHistory(recentPriceHistory)

	supportLines, resistanceLines := detector.GetActiveTrendlines(recentPriceHistory)
	trendlines := ta.convertToTrendlineDisplays(supportLines, resistanceLines, recentPriceHistory)
	result.SetTrendlines(trendlines)

	return result, nil
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
	priceHistory []*market.PriceData,
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
// Trendlines extend from start_date to broken_at (if crossed) or end_date (if not broken).
func (ta *trendlineAnalyzer) createTrendlineDisplay(
	line trendline.Trendline,
	priceHistory []*market.PriceData,
) market.TrendlineDisplay {
	startPrice, endPrice := ta.trendlinePivotPrices(line)

	dateToIndexMap := make(map[string]int, len(priceHistory))
	for i, p := range priceHistory {
		dateToIndexMap[p.Date] = i
	}

	var brokenAt *string
	var brokenType *string
	if len(line.Crosses) > 0 {
		earliestCross := line.Crosses[0]
		brokenAt = &earliestCross.Date
		brokenType = &earliestCross.CrossType
	}

	var dataPoints []market.TrendlineDataPoint

	startDate := line.StartPivot.Date
	effectiveEndDate := line.EndPivot.Date
	if brokenAt != nil {
		effectiveEndDate = *brokenAt
	}

	for _, p := range priceHistory {
		if p.Date < startDate {
			continue
		}
		if p.Date > effectiveEndDate {
			break
		}

		index := dateToIndexMap[p.Date]
		var trendlinePrice float64
		if line.UseLogScale {
			trendlinePrice = line.PriceAtLog(index)
		} else {
			trendlinePrice = line.PriceAt(index)
		}
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
		BrokenAt:   brokenAt,
		BrokenType: brokenType,
	}
}
