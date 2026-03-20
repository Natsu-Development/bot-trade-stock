package provider

import (
	"context"
	"fmt"
	"sync/atomic"

	"bot-trade/application/port/outbound"
	_ "bot-trade/infrastructure/provider/sources"

	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
)

// ProviderPool implements MarketDataGateway with round-robin selection.
type ProviderPool struct {
	providers []*WrappedProvider
	primary   string
	rrIndex   int32
}

// Verify interface compliance at compile time.
var _ outbound.MarketGateway = (*ProviderPool)(nil)
var _ outbound.StockLister = (*ProviderPool)(nil)

// NewProviderPool creates a new provider pool.
func NewProviderPool(providers []*WrappedProvider, primary string) (*ProviderPool, error) {
	// Validate primary provider exists
	for _, p := range providers {
		if p.Name() == primary {
			zap.L().Info("Provider pool initialized",
				zap.Int("provider_count", len(providers)),
				zap.String("primary_provider", primary),
			)

			return &ProviderPool{
				providers: providers,
				primary:   primary,
				rrIndex:   0,
			}, nil
		}
	}
	return nil, fmt.Errorf("primary provider %q not found in provider pool", primary)
}

// FetchData fetches stock data using round-robin selection.
func (p *ProviderPool) FetchData(ctx context.Context, q marketvo.MarketDataQuery) ([]marketvo.MarketData, error) {
	tried := make(map[int]bool)

	for {
		idx := p.selectProvider()
		if tried[idx] {
			// Tried all providers
			return nil, fmt.Errorf("all providers failed for symbol %s", q.Symbol)
		}
		tried[idx] = true

		result, err := p.providers[idx].FetchObserved(ctx, q)
		if err != nil {
			zap.L().Warn("Provider failed",
				zap.String("provider", p.providers[idx].Name()),
				zap.String("symbol", string(q.Symbol)),
				zap.Error(err),
			)
			continue
		}

		return result, nil
	}
}

// ListAllStocks lists all stocks using the primary provider.
func (p *ProviderPool) ListAllStocks(ctx context.Context) ([]marketvo.StockInfo, error) {
	// Use primary provider for stock listing
	for _, wp := range p.providers {
		if wp.Name() == p.primary {
			// Type assertion to check if provider supports StockLister
			lister, ok := wp.source.(outbound.StockLister)
			if !ok {
				return nil, fmt.Errorf("primary provider %q does not support ListAllStocks", wp.Name())
			}
			return lister.ListAllStocks(ctx)
		}
	}
	return nil, fmt.Errorf("primary provider %q not found", p.primary)
}

// selectProvider returns next healthy provider. Falls back to primary if all unhealthy.
func (p *ProviderPool) selectProvider() int {
	if len(p.providers) == 0 {
		return 0
	}

	// Round-robin: try each provider once
	start := int(atomic.AddInt32(&p.rrIndex, 1)-1) % len(p.providers)
	for i := 0; i < len(p.providers); i++ {
		idx := (start + i) % len(p.providers)
		if p.providers[idx].IsHealthy() {
			return idx
		}
	}

	// All unhealthy - return primary
	for i, wp := range p.providers {
		if wp.Name() == p.primary {
			return i
		}
	}
	return 0
}
