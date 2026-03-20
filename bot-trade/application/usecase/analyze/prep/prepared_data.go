package prep

import (
	"context"
	"fmt"

	"bot-trade/application/port/inbound"
	"bot-trade/application/port/outbound"
	configagg "bot-trade/domain/config/aggregate"
	sharedservice "bot-trade/domain/shared/service"
	marketvo "bot-trade/domain/shared/valueobject/market"
)

// DataPrepare contains all data needed for analysis.
// Shared across all specialized use cases to avoid duplicate fetching.
type DataPrepare struct {
	Symbol     string
	Config     *configagg.TradingConfig
	DataRecent []marketvo.MarketData
	DataFull   []marketvo.MarketData
}

// Preparer handles common data preparation for all use cases.
// DRY - avoids duplicating data fetching logic across specialized use cases.
type Preparer struct {
	configManager     inbound.ConfigManager
	marketDataGateway outbound.MarketGateway
}

// NewPreparer creates a new DataPreparer.
func NewPreparer(
	configManager inbound.ConfigManager,
	marketDataGateway outbound.MarketGateway,
) *Preparer {
	return &Preparer{
		configManager:     configManager,
		marketDataGateway: marketDataGateway,
	}
}

// Prepare fetches config, market data, calculates RSI, and slices recent data.
// Returns DataPrepare containing everything needed for analysis.
func (p *Preparer) Prepare(
	ctx context.Context,
	q marketvo.MarketDataQuery,
	configID string,
) (*DataPrepare, error) {
	symbol := string(q.Symbol)

	// 1. Fetch config
	config, err := p.configManager.GetConfig(ctx, configID)
	if err != nil {
		return nil, fmt.Errorf("failed to load trading configuration: %w", err)
	}

	// 2. Fetch market data
	priceHistory, err := p.marketDataGateway.FetchData(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch stock data: %w", err)
	}
	if len(priceHistory) == 0 {
		return nil, fmt.Errorf("no price data available for %s", symbol)
	}

	// 3. Calculate RSI on FULL price history
	rsiPeriod := int(config.RSIPeriod)
	dataWithRSI := sharedservice.CalculateRSI(priceHistory, rsiPeriod)
	if len(dataWithRSI) == 0 {
		return nil, fmt.Errorf("insufficient data for RSI calculation: need at least %d data points", rsiPeriod+1)
	}

	// 4. Slice recent data AFTER RSI calculation
	indicesRecent := int(config.IndicesRecent)
	if len(dataWithRSI) < indicesRecent {
		return nil, fmt.Errorf("insufficient RSI data: required %d, got %d", indicesRecent, len(dataWithRSI))
	}
	startIndex := len(dataWithRSI) - indicesRecent
	dataRecent := dataWithRSI[startIndex:]

	return &DataPrepare{
		Symbol:     symbol,
		Config:     config,
		DataRecent: dataRecent,
		DataFull:   dataWithRSI,
	}, nil
}
