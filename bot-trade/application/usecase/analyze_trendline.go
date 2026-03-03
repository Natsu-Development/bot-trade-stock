package usecase

import (
	"context"
	"fmt"
	"time"

	appPort "bot-trade/application/port"
	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/service/trendline"

	"go.uber.org/zap"
)

var _ appPort.TrendlineAnalyzer = (*AnalyzeTrendlineUseCase)(nil)

// AnalyzeTrendlineUseCase orchestrates trendline-based signal analysis.
type AnalyzeTrendlineUseCase struct {
	configRepository  appPort.ConfigRepository
	marketDataGateway appPort.MarketDataGateway
	logger            *zap.Logger
}

// NewAnalyzeTrendlineUseCase creates a new trendline analysis use case.
func NewAnalyzeTrendlineUseCase(
	configRepository appPort.ConfigRepository,
	marketDataGateway appPort.MarketDataGateway,
	logger *zap.Logger,
) *AnalyzeTrendlineUseCase {
	return &AnalyzeTrendlineUseCase{
		configRepository:  configRepository,
		marketDataGateway: marketDataGateway,
		logger:            logger,
	}
}

// Execute performs trendline analysis for a single symbol, fetching its own market data.
func (uc *AnalyzeTrendlineUseCase) Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*market.SignalAnalysisResult, error) {
	priceHistory, err := uc.marketDataGateway.FetchStockData(ctx, q)
	if err != nil {
		uc.logger.Error("Failed to fetch stock data",
			zap.String("symbol", q.Symbol),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch stock data: %w", err)
	}

	return uc.ExecuteWithData(ctx, priceHistory, q, configID)
}

// ExecuteWithData performs trendline analysis using pre-fetched price data.
func (uc *AnalyzeTrendlineUseCase) ExecuteWithData(ctx context.Context, priceHistory []*market.PriceData, q market.MarketDataQuery, configID string) (*market.SignalAnalysisResult, error) {
	symbol := q.Symbol

	tradingConfig, err := uc.configRepository.GetByID(ctx, configID)
	if err != nil {
		uc.logger.Error("Failed to load trading configuration",
			zap.String("configID", configID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to load trading configuration: %w", err)
	}

	uc.logger.Info("Trendline analysis",
		zap.String("symbol", symbol),
		zap.String("configID", configID),
	)
	startTime := time.Now()

	indicesRecent := tradingConfig.Divergence.IndicesRecent
	if len(priceHistory) < indicesRecent {
		uc.logger.Warn("Insufficient price data",
			zap.String("symbol", symbol),
			zap.Int("required", indicesRecent),
			zap.Int("actual", len(priceHistory)),
		)
		return nil, fmt.Errorf("insufficient price data: required %d, got %d", indicesRecent, len(priceHistory))
	}

	recentPriceHistory := priceHistory[len(priceHistory)-indicesRecent:]

	detector := trendline.NewDetector(trendline.DefaultTrendlineConfig())

	// Detect signals (RSI not needed for trendline-based signals)
	signalsResult, err := detector.DetectSignals(recentPriceHistory)
	if err != nil {
		return nil, fmt.Errorf("failed to detect signals: %w", err)
	}

	// Get current price from the last data point
	currentPrice := recentPriceHistory[len(recentPriceHistory)-1].Close

	// Convert to domain trading signals
	signals := make([]market.TradingSignal, 0, len(signalsResult))
	for _, bs := range signalsResult {
		signal := market.NewTradingSignal(
			symbol,
			bs.Type,
			bs.Price,
			0, // no confidence score
			bs.Message,
			"trendline",
		)
		signal.Time = bs.Time
		signal.Interval = q.Interval

		// Add trendline info if present
		if bs.Trendline.IsValid {
			// Use correct price based on trendline type:
			// - Uptrend support uses pivot lows
			// - Downtrend resistance uses pivot highs
			var startPrice, endPrice float64
			if bs.Trendline.Type == trendline.UptrendSupport {
				startPrice = bs.Trendline.StartPivot.Low
				endPrice = bs.Trendline.EndPivot.Low
			} else {
				startPrice = bs.Trendline.StartPivot.High
				endPrice = bs.Trendline.EndPivot.High
			}

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
	uc.logger.Info("Trendline analysis completed",
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
		0, // CurrentRSI not used for trendline signals
	)
	// Set the recent price history to match the trendline data_points range
	// This ensures the candlestick chart and trendlines are aligned correctly
	result.SetPriceHistory(recentPriceHistory)

	// Set trendlines for display with pre-calculated data points
	supportLines, resistanceLines := detector.GetActiveTrendlines(recentPriceHistory)
	trendlines := uc.convertToTrendlineDisplays(supportLines, resistanceLines, recentPriceHistory)
	result.SetTrendlines(trendlines)

	return result, nil
}

// DetectWatchingSignals returns only watching/potential signals for monitoring.
func (uc *AnalyzeTrendlineUseCase) DetectWatchingSignals(ctx context.Context, q market.MarketDataQuery, configID string) ([]market.TradingSignal, error) {
	result, err := uc.Execute(ctx, q, configID)
	if err != nil {
		return nil, err
	}

	return result.GetWatchingSignals(), nil
}

// DetectConfirmedSignals returns only confirmed signals for execution.
func (uc *AnalyzeTrendlineUseCase) DetectConfirmedSignals(ctx context.Context, q market.MarketDataQuery, configID string) ([]market.TradingSignal, error) {
	result, err := uc.Execute(ctx, q, configID)
	if err != nil {
		return nil, err
	}

	return result.GetConfirmedSignals(), nil
}

// convertToTrendlineDisplays converts backend trendlines to display format with pre-calculated data points.
func (uc *AnalyzeTrendlineUseCase) convertToTrendlineDisplays(
	supportLines, resistanceLines []trendline.Trendline,
	priceHistory []*market.PriceData,
) []market.TrendlineDisplay {
	var trendlines []market.TrendlineDisplay

	// Process support lines
	for _, line := range supportLines {
		display := uc.createTrendlineDisplay(line, priceHistory)
		trendlines = append(trendlines, display)
	}

	// Process resistance lines
	for _, line := range resistanceLines {
		display := uc.createTrendlineDisplay(line, priceHistory)
		trendlines = append(trendlines, display)
	}

	return trendlines
}

// createTrendlineDisplay creates a TrendlineDisplay from a Trendline with pre-calculated data points.
// Trendlines extend from start_date to:
// - broken_at (if the trendline was crossed/broken), OR
// - end_date (if not broken, stop at the last pivot)
// This ensures trendlines don't extend to current price when not broken,
// but DO extend to show where they were actually broken.
func (uc *AnalyzeTrendlineUseCase) createTrendlineDisplay(
	line trendline.Trendline,
	priceHistory []*market.PriceData,
) market.TrendlineDisplay {
	// Determine start and end prices based on trendline type
	var startPrice, endPrice float64
	if line.Type == trendline.UptrendSupport {
		startPrice = line.StartPivot.Low
		endPrice = line.EndPivot.Low
	} else {
		startPrice = line.StartPivot.High
		endPrice = line.EndPivot.High
	}

	// Build date-to-index map for price history
	dateToIndexMap := make(map[string]int)
	for i, p := range priceHistory {
		dateToIndexMap[p.Date] = i
	}

	// Find the first cross event (if any) - trendline extends to this point
	var brokenAt *string
	var brokenType *string
	if len(line.Crosses) > 0 {
		// Get the earliest cross event
		earliestCross := line.Crosses[0]
		brokenAt = &earliestCross.Date
		brokenType = &earliestCross.CrossType
	}

	// Calculate trendline price at each trading date in the price history
	// Start from the trendline's start_date and stop at:
	// - broken_at (if crossed), OR
	// - end_date (if not crossed)
	// This shows the trendline up to where it was invalidated, not to current price
	var dataPoints []market.TrendlineDataPoint

	// Parse start and end dates for comparison
	startDate := line.StartPivot.Date
	endDate := line.EndPivot.Date

	// Determine the effective end date for the trendline
	// If broken, extend to broken_at; otherwise, stop at end_date
	effectiveEndDate := endDate
	if brokenAt != nil {
		effectiveEndDate = *brokenAt
	}

	for _, p := range priceHistory {
		// Skip dates before the trendline start date
		if p.Date < startDate {
			continue
		}

		// Stop if we've passed the effective end date
		if p.Date > effectiveEndDate {
			break
		}

		index := dateToIndexMap[p.Date]
		// Use the correct price calculation method based on the trendline's scale
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
