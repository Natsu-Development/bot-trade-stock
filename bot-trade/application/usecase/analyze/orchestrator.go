package analyze

import (
	"context"
	"fmt"
	"time"

	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	"bot-trade/domain/aggregate/analysis"
	"bot-trade/domain/aggregate/market"
	"bot-trade/domain/service/indicator"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

var _ inbound.Analyzer = (*AnalyzeUseCase)(nil)

// AnalyzeUseCase orchestrates all analysis types (bullish divergence, bearish divergence, trendline)
// in a single unified use case. Fetches config and market data once, then shares across internal sub-analyzers.
type AnalyzeUseCase struct {
	configRepository  outbound.ConfigRepository
	marketDataGateway outbound.MarketDataGateway
	bullishDivergence  *divergenceAnalyzer
	bearishDivergence  *divergenceAnalyzer
	trendlineAnalyzer  *trendlineAnalyzer
	logger            *zap.Logger
}

// NewAnalyzer creates a new unified analysis use case with internal sub-analyzers.
func NewAnalyzer(
	configRepository outbound.ConfigRepository,
	marketDataGateway outbound.MarketDataGateway,
	logger *zap.Logger,
) *AnalyzeUseCase {
	return &AnalyzeUseCase{
		configRepository:  configRepository,
		marketDataGateway: marketDataGateway,
		bullishDivergence:  newDivergenceAnalyzer(analysis.BullishDivergence, logger),
		bearishDivergence:  newDivergenceAnalyzer(analysis.BearishDivergence, logger),
		trendlineAnalyzer:  newTrendlineAnalyzer(logger),
		logger:            logger,
	}
}

// Execute performs all analysis types for a single symbol.
// Fetches config and market data once, prepares data (slicing, RSI calculation),
// then runs internal sub-analyzers in parallel.
func (uc *AnalyzeUseCase) Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*market.CombinedAnalysisResult, error) {
	symbol := q.Symbol

	// 1. Fetch config
	tradingConfig, err := uc.configRepository.GetByID(ctx, configID)
	if err != nil {
		uc.logger.Error("Failed to load trading configuration",
			zap.String("configID", configID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to load trading configuration: %w", err)
	}

	uc.logger.Info("Unified analysis",
		zap.String("symbol", symbol),
		zap.String("configID", configID),
	)
	startTime := time.Now()

	// 2. Fetch market data (FLATTENED - no helper function)
	priceHistory, err := uc.marketDataGateway.FetchStockData(ctx, q)
	if err != nil {
		uc.logger.Error("Failed to fetch stock data",
			zap.String("symbol", q.Symbol),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch stock data: %w", err)
	}
	if len(priceHistory) == 0 {
		return nil, fmt.Errorf("no price data available for %s", q.Symbol)
	}

	// 3. Slice recent data (FLATTENED - inline, no helper function)
	indicesCount := tradingConfig.Divergence.IndicesRecent
	if len(priceHistory) < indicesCount {
		uc.logger.Warn("Insufficient price data",
			zap.String("symbol", symbol),
			zap.Int("required", indicesCount),
			zap.Int("actual", len(priceHistory)),
		)
		return nil, fmt.Errorf("insufficient price data: required %d, got %d", indicesCount, len(priceHistory))
	}
	startIndex := len(priceHistory) - indicesCount
	recentPriceHistory := priceHistory[startIndex:]

	// 4. Calculate RSI ONCE
	dataWithRSI := indicator.CalculateRSI(recentPriceHistory, tradingConfig.RSIPeriod)
	if len(dataWithRSI) == 0 {
		return nil, fmt.Errorf("insufficient data for RSI calculation")
	}

	// 5. Extract current price and RSI (FLATTENED - inline)
	var currentPrice, currentRSI float64
	for i := len(dataWithRSI) - 1; i >= 0; i-- {
		if dataWithRSI[i].RSI != 0 {
			currentPrice = dataWithRSI[i].Close
			currentRSI = dataWithRSI[i].RSI
			break
		}
	}

	// 6. Run internal sub-analyzers with PREPARED DATA (parallel)
	// Sub-analyzers only perform detection logic
	var (
		bullishResult *analysis.AnalysisResult
		bearishResult *analysis.AnalysisResult
		signalsResult *market.SignalAnalysisResult
	)

	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		result, err := uc.bullishDivergence.detect(gctx, dataWithRSI, currentPrice, currentRSI, q, tradingConfig)
		if err != nil {
			return fmt.Errorf("bullish divergence analysis failed: %w", err)
		}
		bullishResult = result
		return nil
	})

	g.Go(func() error {
		result, err := uc.bearishDivergence.detect(gctx, dataWithRSI, currentPrice, currentRSI, q, tradingConfig)
		if err != nil {
			return fmt.Errorf("bearish divergence analysis failed: %w", err)
		}
		bearishResult = result
		return nil
	})

	g.Go(func() error {
		result, err := uc.trendlineAnalyzer.detect(gctx, recentPriceHistory, currentPrice, q, tradingConfig)
		if err != nil {
			return fmt.Errorf("trendline signal analysis failed: %w", err)
		}
		signalsResult = result
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	processingTime := time.Since(startTime)

	combinedResult := market.NewCombinedAnalysisResult(
		symbol,
		processingTime.Milliseconds(),
		q.StartDate,
		q.EndDate,
		q.Interval,
		currentPrice,
	)

	if bullishResult != nil {
		combinedResult.SetBullishDivergence(bullishResult)
	}
	if bearishResult != nil {
		combinedResult.SetBearishDivergence(bearishResult)
	}

	if signalsResult != nil {
		combinedResult.SetSignals(signalsResult.Signals)
		combinedResult.SetPriceHistory(signalsResult.PriceHistory)
		combinedResult.SetTrendlines(signalsResult.Trendlines)
	}

	uc.logger.Info("Unified analysis completed",
		zap.String("symbol", symbol),
		zap.Duration("duration", processingTime),
		zap.Bool("bullish_divergence", combinedResult.BullishDivergence != nil && combinedResult.BullishDivergence.HasDivergence()),
		zap.Bool("bearish_divergence", combinedResult.BearishDivergence != nil && combinedResult.BearishDivergence.HasDivergence()),
		zap.Int("signals_count", len(combinedResult.Signals)),
	)

	return combinedResult, nil
}
