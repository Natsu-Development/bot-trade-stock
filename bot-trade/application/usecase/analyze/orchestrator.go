package analyze

import (
	"context"
	"fmt"
	"time"

	"bot-trade/application/dto"
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
func (uc *AnalyzeUseCase) Execute(ctx context.Context, q market.MarketDataQuery, configID string) (*dto.AnalysisResult, error) {
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

	// 2. Fetch market data
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

	// 3. Calculate RSI on FULL price history first (requires period+1 data points)
	// Convert []*PriceData to []*PriceData for RSI calculation
	priceDataForRSI := make([]*market.PriceData, len(priceHistory))
	for i := range priceHistory {
		priceDataForRSI[i] = &market.PriceData{
			Date:   priceHistory[i].Date,
			Open:   priceHistory[i].Open,
			High:   priceHistory[i].High,
			Low:    priceHistory[i].Low,
			Close:  priceHistory[i].Close,
			Volume: priceHistory[i].Volume,
		}
	}

	dataWithRSI := indicator.CalculateRSI(priceDataForRSI, tradingConfig.RSIPeriod)
	if len(dataWithRSI) == 0 {
		return nil, fmt.Errorf("insufficient data for RSI calculation: need at least %d data points", tradingConfig.RSIPeriod+1)
	}

	// 4. Slice recent data AFTER RSI calculation
	indicesCount := tradingConfig.Divergence.IndicesRecent
	if len(dataWithRSI) < indicesCount {
		uc.logger.Warn("Insufficient RSI data",
			zap.String("symbol", symbol),
			zap.Int("required", indicesCount),
			zap.Int("actual", len(dataWithRSI)),
		)
		return nil, fmt.Errorf("insufficient RSI data: required %d, got %d", indicesCount, len(dataWithRSI))
	}
	startIndex := len(dataWithRSI) - indicesCount
	recentDataWithRSI := dataWithRSI[startIndex:]

	// 5. Extract current price and RSI from MarketData
	var currentPrice, currentRSI float64
	for i := len(dataWithRSI) - 1; i >= 0; i-- {
		if dataWithRSI[i].RSI != 0 {
			currentPrice = dataWithRSI[i].Close
			currentRSI = dataWithRSI[i].RSI
			break
		}
	}

	// 6. Run internal sub-analyzers with PREPARED DATA (parallel)
	var (
		bullishResult  *analysis.AnalysisResult
		bearishResult  *analysis.AnalysisResult
		trendSignals   []market.TradingSignal
		trendHistory   []*market.PriceData
		trendTrendlines []market.TrendlineDisplay
	)

	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		result, err := uc.bullishDivergence.detect(gctx, recentDataWithRSI, currentPrice, currentRSI, q, tradingConfig)
		if err != nil {
			return fmt.Errorf("bullish divergence analysis failed: %w", err)
		}
		bullishResult = result
		return nil
	})

	g.Go(func() error {
		result, err := uc.bearishDivergence.detect(gctx, recentDataWithRSI, currentPrice, currentRSI, q, tradingConfig)
		if err != nil {
			return fmt.Errorf("bearish divergence analysis failed: %w", err)
		}
		bearishResult = result
		return nil
	})

	g.Go(func() error {
		signals, history, trendlines, err := uc.trendlineAnalyzer.detect(gctx, recentDataWithRSI, currentPrice, q, tradingConfig)
		if err != nil {
			return fmt.Errorf("trendline signal analysis failed: %w", err)
		}
		trendSignals = signals
		trendHistory = history
		trendTrendlines = trendlines
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	processingTime := time.Since(startTime)

	// Create DTO with builder pattern
	combinedResult := dto.NewAnalysisResult(
		symbol,
		q.StartDate,
		q.EndDate,
		q.Interval,
		currentPrice,
	).
		WithProcessingTime(processingTime.Milliseconds()).
		WithCurrentRSI(currentRSI)

	if bullishResult != nil {
		combinedResult.WithBullishDivergence(bullishResult)
	}
	if bearishResult != nil {
		combinedResult.WithBearishDivergence(bearishResult)
	}

	combinedResult.WithSignals(trendSignals)
	combinedResult.WithPriceHistory(trendHistory)
	combinedResult.WithTrendlines(trendTrendlines)

	uc.logger.Info("Unified analysis completed",
		zap.String("symbol", symbol),
		zap.Duration("duration", processingTime),
		zap.Bool("bullish_divergence", combinedResult.HasAnyDivergence()),
		zap.Int("signals_count", len(combinedResult.Signals)),
	)

	return combinedResult, nil
}
