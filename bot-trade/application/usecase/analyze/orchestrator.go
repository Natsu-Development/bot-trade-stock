package analyze

import (
	"context"
	"time"

	"bot-trade/application/dto"
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	appPrep "bot-trade/application/usecase/analyze/prep"
	appRsi "bot-trade/application/usecase/analyze/rsi"
	appTrendline "bot-trade/application/usecase/analyze/trendline"
	configagg "bot-trade/domain/config/aggregate"
	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
)

var _ inbound.Analyzer = (*AnalyzeUseCase)(nil)

// AnalyzeUseCase orchestrates analysis by composing specialized use cases.
// Returns a plain DTO - no aggregate wrapper needed.
// Used by the HTTP API for full analysis results.
type AnalyzeUseCase struct {
	preparer         *appPrep.Preparer
	bullishUsecase   *appRsi.BullishRSIUseCase
	bearishUsecase   *appRsi.BearishRSIUseCase
	breakdownUsecase *appTrendline.BreakdownUseCase
	breakoutUsecase  *appTrendline.BreakoutUseCase
	configManager    inbound.ConfigManager
	logger           *zap.Logger
}

// NewAnalyzer creates a new unified analysis use case.
// It composes specialized use cases while maintaining backward compatibility.
func NewAnalyzer(
	configManager inbound.ConfigManager,
	marketDataGateway outbound.MarketDataGateway,
	logger *zap.Logger,
) *AnalyzeUseCase {
	preparer := appPrep.NewPreparer(configManager, marketDataGateway, logger)

	return &AnalyzeUseCase{
		preparer:         preparer,
		bullishUsecase:   appRsi.NewBullishRSIUseCase(logger),
		bearishUsecase:   appRsi.NewBearishRSIUseCase(logger),
		breakdownUsecase: appTrendline.NewBreakdownUseCase(logger),
		breakoutUsecase:  appTrendline.NewBreakoutUseCase(logger),
		configManager:    configManager,
		logger:           logger,
	}
}

// GetConfig fetches a trading configuration by ID without running analysis.
// Used by handlers to retrieve config values (e.g., LookbackDay) for query parameter calculation.
// Delegates to ConfigManager to avoid code duplication.
func (uc *AnalyzeUseCase) GetConfig(ctx context.Context, configID string) (*configagg.TradingConfig, error) {
	return uc.configManager.GetConfig(ctx, configID)
}

// Execute performs all analysis for a symbol.
// Composes results from specialized use cases into a unified result.
// Returns a plain DTO with combined divergences and computed trendline data points.
func (uc *AnalyzeUseCase) Execute(
	ctx context.Context,
	q marketvo.MarketDataQuery,
	configID string,
) (*dto.AnalysisResult, error) {
	symbol := string(q.Symbol)
	startTime := time.Now()
	uc.logger.Info("Starting analysis",
		zap.String("symbol", symbol),
		zap.String("configID", configID),
	)

	// Prepare data ONCE - all use cases share the same prepared data
	data, err := uc.preparer.Prepare(ctx, q, configID)
	if err != nil {
		return nil, err
	}

	// Run specialized use cases with prepared data (no I/O in use cases)
	bullishResult, err := uc.bullishUsecase.Execute(data)
	if err != nil {
		return nil, err
	}

	bearishResult, err := uc.bearishUsecase.Execute(data)
	if err != nil {
		return nil, err
	}

	breakdownTrendlines, breakdownSignals, err := uc.breakdownUsecase.Execute(data)
	if err != nil {
		return nil, err
	}

	breakoutTrendlines, breakoutSignals, err := uc.breakoutUsecase.Execute(data)
	if err != nil {
		return nil, err
	}

	// Combine results
	divergences := append(bullishResult, bearishResult...)
	trendlines := append(breakdownTrendlines, breakoutTrendlines...)
	signals := append(breakdownSignals, breakoutSignals...)
	priceHistoryDTOs := dto.ToMarketDataDTOs(data.DataFull)

	// Build result
	result := &dto.AnalysisResult{
		Symbol:       symbol,
		Divergences:  divergences,
		Trendlines:   trendlines,
		Signals:      signals,
		PriceHistory: priceHistoryDTOs,
		Timestamp:    time.Now(),
	}

	processingTime := time.Since(startTime)
	result.ProcessingTimeMs = processingTime.Milliseconds()

	uc.logger.Info("Analysis completed",
		zap.String("symbol", symbol),
		zap.Duration("duration", processingTime),
		zap.Bool("bullish_divergence", len(bullishResult) > 0),
		zap.Bool("bearish_divergence", len(bearishResult) > 0),
		zap.Int("signals_count", len(signals)),
	)

	return result, nil
}
