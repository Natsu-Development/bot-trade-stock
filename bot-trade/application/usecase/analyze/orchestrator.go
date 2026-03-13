package analyze

import (
	"context"
	"fmt"
	"time"

	"bot-trade/application/dto"
	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	analysisservice "bot-trade/domain/analysis/service"
	analysisvo "bot-trade/domain/analysis/valueobject"
	configagg "bot-trade/domain/config/aggregate"
	sharedservice "bot-trade/domain/shared/service"
	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
)

var _ inbound.Analyzer = (*AnalyzeUseCase)(nil)

// AnalyzeUseCase orchestrates analysis by calling domain services directly.
// Returns a plain DTO - no aggregate wrapper needed.
type AnalyzeUseCase struct {
	configManager     inbound.ConfigManager
	marketDataGateway outbound.MarketDataGateway
	logger            *zap.Logger
}

// NewAnalyzer creates a new unified analysis use case.
func NewAnalyzer(
	configManager inbound.ConfigManager,
	marketDataGateway outbound.MarketDataGateway,
	logger *zap.Logger,
) *AnalyzeUseCase {
	return &AnalyzeUseCase{
		configManager:     configManager,
		marketDataGateway: marketDataGateway,
		logger:            logger,
	}
}

// GetConfig fetches a trading configuration by ID without running analysis.
// Used by handlers to retrieve config values (e.g., LookbackDay) for query parameter calculation.
// Delegates to ConfigManager to avoid code duplication.
func (uc *AnalyzeUseCase) GetConfig(ctx context.Context, configID string) (*configagg.TradingConfig, error) {
	return uc.configManager.GetConfig(ctx, configID)
}

// Execute performs all analysis for a symbol.
// Calls domain services directly - no aggregate wrapper needed.
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

	// 1. Fetch config
	tradingConfig, err := uc.configManager.GetConfig(ctx, configID)
	if err != nil {
		uc.logger.Error("Failed to load trading configuration",
			zap.String("configID", configID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to load trading configuration: %w", err)
	}

	// 2. Fetch market data
	priceHistory, err := uc.marketDataGateway.FetchStockData(ctx, q)
	if err != nil {
		uc.logger.Error("Failed to fetch stock data",
			zap.String("symbol", string(q.Symbol)),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch stock data: %w", err)
	}
	if len(priceHistory) == 0 {
		return nil, fmt.Errorf("no price data available for %s", symbol)
	}

	// 3. Calculate RSI on FULL price history
	rsiPeriod := int(tradingConfig.RSIPeriod)
	dataWithRSI := sharedservice.CalculateRSI(priceHistory, rsiPeriod)
	if len(dataWithRSI) == 0 {
		return nil, fmt.Errorf("insufficient data for RSI calculation: need at least %d data points", rsiPeriod+1)
	}

	// 4. Slice recent data AFTER RSI calculation
	indicesRecent := int(tradingConfig.IndicesRecent)
	if len(dataWithRSI) < indicesRecent {
		uc.logger.Warn("Insufficient RSI data",
			zap.String("symbol", symbol),
			zap.Int("required", indicesRecent),
			zap.Int("actual", len(dataWithRSI)),
		)
		return nil, fmt.Errorf("insufficient RSI data: required %d, got %d", indicesRecent, len(dataWithRSI))
	}
	startIndex := len(dataWithRSI) - indicesRecent
	dataRecent := dataWithRSI[startIndex:]

	// 5. Call domain services directly
	pivotPeriod := int(tradingConfig.PivotPeriod)

	// 5a. Find pivots
	rsiHighPivots := analysisservice.FindHighPivots(dataRecent, analysisvo.FieldRSI, pivotPeriod)
	rsiLowPivots := analysisservice.FindLowPivots(dataRecent, analysisvo.FieldRSI, pivotPeriod)
	priceHighPivots := analysisservice.FindHighPivots(dataRecent, analysisvo.FieldHigh, pivotPeriod)
	priceLowPivots := analysisservice.FindLowPivots(dataRecent, analysisvo.FieldLow, pivotPeriod)

	// 5b. Detect divergences
	bearishDivergences := analysisservice.FindBearishDivergences(
		rsiHighPivots,
		tradingConfig.Divergence.RangeMin,
		tradingConfig.Divergence.RangeMax,
	)
	bullishDivergences := analysisservice.FindBullishDivergences(
		rsiLowPivots,
		tradingConfig.Divergence.RangeMin,
		tradingConfig.Divergence.RangeMax,
	)

	// 5c. Build trendlines
	supportTrendlines := analysisservice.BuildSupportTrendlines(
		priceLowPivots,
		tradingConfig.Trendline.MaxLines,
	)
	resistanceTrendlines := analysisservice.BuildResistanceTrendlines(
		priceHighPivots,
		tradingConfig.Trendline.MaxLines,
	)

	// 5d. Generate signals
	supportSignals := analysisservice.GenerateSupportSignals(
		supportTrendlines,
		dataRecent,
		tradingConfig.Trendline.ProximityPercent,
	)
	resistanceSignals := analysisservice.GenerateResistanceSignals(
		resistanceTrendlines,
		dataRecent,
		tradingConfig.Trendline.ProximityPercent,
	)

	// 6. Convert domain results to DTOs
	divergences := dto.ToDivergenceDTOs(append(bullishDivergences, bearishDivergences...))
	trendlinesDTOs := dto.ToTrendlineDTOs(dataRecent, append(supportTrendlines, resistanceTrendlines...))
	signalDTOs := dto.ToSignalDTOs(append(supportSignals, resistanceSignals...))
	priceHistoryDTOs := dto.ToMarketDataDTOs(dataWithRSI)

	// 7. Build result DTO
	result := &dto.AnalysisResult{
		Symbol:       symbol,
		Divergences:  divergences,
		Trendlines:   trendlinesDTOs,
		Signals:      signalDTOs,
		PriceHistory: priceHistoryDTOs,
		Timestamp:    time.Now(),
	}

	// 11. Log completion
	processingTime := time.Since(startTime)
	result.ProcessingTimeMs = processingTime.Milliseconds()

	uc.logger.Info("Analysis completed",
		zap.String("symbol", symbol),
		zap.Duration("duration", processingTime),
		zap.Bool("bullish_divergence", len(bullishDivergences) > 0),
		zap.Bool("bearish_divergence", len(bearishDivergences) > 0),
		zap.Int("signals_count", len(signalDTOs)),
	)

	return result, nil
}
