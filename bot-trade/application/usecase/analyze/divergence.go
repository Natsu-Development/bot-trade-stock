package analyze

import (
	"context"
	"fmt"
	"time"

	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/config"
	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/service/divergence"

	"go.uber.org/zap"
)

// divergenceAnalyzer is internal - not exported.
// Performs ONLY divergence detection (data already prepared by orchestrator).
type divergenceAnalyzer struct {
	divergenceType analysis.DivergenceType
	logger         *zap.Logger
}

func newDivergenceAnalyzer(divergenceType analysis.DivergenceType, logger *zap.Logger) *divergenceAnalyzer {
	return &divergenceAnalyzer{
		divergenceType: divergenceType,
		logger:         logger,
	}
}

// detect performs ONLY divergence detection using pre-calculated RSI data.
// Data preparation (fetching, slicing, RSI calculation) happens in the orchestrator.
func (da *divergenceAnalyzer) detect(
	_ context.Context,
	dataWithRSI []market.PriceDataWithRSI,
	currentPrice, currentRSI float64,
	q market.MarketDataQuery,
	cfg *config.TradingConfig,
) (*analysis.AnalysisResult, error) {
	symbol := q.Symbol
	strategyType := da.divergenceType.String()

	da.logger.Debug(fmt.Sprintf("%s divergence detection", strategyType),
		zap.String("symbol", symbol),
		zap.String("configID", cfg.ID),
	)
	startTime := time.Now()

	// Create detector configuration
	detectorConfig, err := divergence.NewConfig(
		cfg.Divergence.LookbackLeft,
		cfg.Divergence.LookbackRight,
		cfg.Divergence.RangeMin,
		cfg.Divergence.RangeMax,
	)
	if err != nil {
		return nil, fmt.Errorf("invalid divergence configuration: %w", err)
	}
	detector := divergence.NewDetector(detectorConfig)

	// Run detection based on type
	var detection divergence.DetectionResult
	var earlyDetection divergence.DetectionResult

	if da.divergenceType == analysis.BullishDivergence {
		detection = detector.DetectBullish(dataWithRSI)
	} else {
		detection = detector.DetectBearish(dataWithRSI)
		earlyDetection = detector.DetectEarlyBearish(dataWithRSI)
	}

	processingTime := time.Since(startTime)
	da.logger.Debug(fmt.Sprintf("%s divergence detection completed", strategyType),
		zap.String("symbol", symbol),
		zap.Duration("duration", processingTime),
		zap.Bool("divergence_found", detection.Found),
		zap.Bool("early_signal", earlyDetection.EarlySignal),
		zap.String("early_description", earlyDetection.EarlyDescription),
	)

	// Create result
	result := analysis.NewAnalysisResult(
		symbol,
		detection.Type,
		detection.Found,
		currentPrice,
		currentRSI,
		detection.Description,
		processingTime.Milliseconds(),
		q.StartDate,
		q.EndDate,
		q.Interval,
		cfg.RSIPeriod,
	)

	// Add divergence price points for easy verification
	if detection.Found && len(detection.PivotPoints) >= 2 {
		result.SetDivergencePoints(
			analysis.DivergencePoint{
				Price: detection.PivotPoints[0].Price,
				Date:  detection.PivotPoints[0].Date,
			},
			analysis.DivergencePoint{
				Price: detection.PivotPoints[1].Price,
				Date:  detection.PivotPoints[1].Date,
			},
		)
	}

	// Add early signal for bearish
	if da.divergenceType == analysis.BearishDivergence && earlyDetection.EarlySignal {
		result.SetEarlySignal(
			earlyDetection.EarlySignal,
			earlyDetection.EarlyDescription,
		)
	}

	return result, nil
}
