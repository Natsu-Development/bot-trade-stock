// Package sources hosts external-API adapters.
//
// Note: SSIQueryProvider is observed (Prometheus) but NOT joined to the
// data-fetch ProviderPool. The pool delivers OHLCV; this adapter serves
// real-time iboard-query quotes for the stock-alert job. Both publish to
// the same metric vectors (labeled by provider name) so Grafana dashboards
// can chart them with one regex (provider=~"ssi.*") or as separate panels.
package sources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"bot-trade/infrastructure/metrics"
	"bot-trade/infrastructure/provider/contract"

	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
)

const (
	ssiQuoteName    = "ssi-quote"
	ssiQuoteBaseURL = "https://iboard-query.ssi.com.vn"
)

// ssiQuoteEndpoints maps exchange code to the iboard-query group endpoint path.
var ssiQuoteEndpoints = map[string]string{
	"hose":  "/stock/exchange/hose",
	"hnx":   "/stock/exchange/hnx",
	"upcom": "/stock/exchange/upcom",
}

// ssiQuoteResponse is the iboard-query response envelope.
type ssiQuoteResponse struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Data    []ssiQuoteItem `json:"data"`
}

// ssiQuoteItem is a single stock quote from iboard-query.
type ssiQuoteItem struct {
	StockSymbol         string  `json:"stockSymbol"`
	MatchedPrice        float64 `json:"matchedPrice"`
	NmTotalTradedQty    int64   `json:"nmTotalTradedQty"`
	NmTotalTradedValue  float64 `json:"nmTotalTradedValue"`
	PriceChange         float64 `json:"priceChange"`
	PriceChangePercent  float64 `json:"priceChangePercent"`
	RefPrice            float64 `json:"refPrice"`
	Ceiling             float64 `json:"ceiling"`
	Floor               float64 `json:"floor"`
	Highest             float64 `json:"highest"`
	Lowest              float64 `json:"lowest"`
	AvgPrice            float64 `json:"avgPrice"`
	Best1Bid            float64 `json:"best1Bid"`
	Best1BidVol         int64   `json:"best1BidVol"`
	Best1Offer          float64 `json:"best1Offer"`
	Best1OfferVol       int64   `json:"best1OfferVol"`
	Best2Bid            float64 `json:"best2Bid"`
	Best2BidVol         int64   `json:"best2BidVol"`
	Best2Offer          float64 `json:"best2Offer"`
	Best2OfferVol       int64   `json:"best2OfferVol"`
	Best3Bid            float64 `json:"best3Bid"`
	Best3BidVol         int64   `json:"best3BidVol"`
	Best3Offer          float64 `json:"best3Offer"`
	Best3OfferVol       int64   `json:"best3OfferVol"`
	TradingDate         string  `json:"tradingDate"`
	Exchange            string  `json:"exchange"`
}

// SSIQueryProvider fetches real-time quotes from SSI iboard-query API.
// Standalone — does NOT implement contract.Provider (which serves OHLCV charts).
// Observed via ProviderMetrics so dashboards see request rate / latency / errors
// for quote-fetches under {provider="ssi-quote"}.
type SSIQueryProvider struct {
	client  *http.Client
	baseURL string
	metrics *metrics.ProviderMetrics
}

// NewSSIQueryProvider creates a new SSI iboard-query adapter.
// Metrics are required so the alert-job's data path is observable; passing nil
// returns an error rather than silently dropping observability.
func NewSSIQueryProvider(client *http.Client, m *metrics.ProviderMetrics) (*SSIQueryProvider, error) {
	if client == nil {
		return nil, fmt.Errorf("ssi-quote: http client is required")
	}
	if m == nil {
		return nil, fmt.Errorf("ssi-quote: provider metrics is required")
	}
	m.InitProvider(ssiQuoteName, 0)
	return &SSIQueryProvider{
		client:  client,
		baseURL: ssiQuoteBaseURL,
		metrics: m,
	}, nil
}

// FetchAllQuotes fetches HOSE, HNX, and UPCOM quotes in parallel and returns a
// flat map keyed by symbol.
func (p *SSIQueryProvider) FetchAllQuotes(ctx context.Context) (map[string]marketvo.MarketQuote, error) {
	g, gctx := errgroup.WithContext(ctx)

	results := make([]map[string]marketvo.MarketQuote, 0, len(ssiQuoteEndpoints))
	resultsCh := make(chan map[string]marketvo.MarketQuote, len(ssiQuoteEndpoints))

	for exchange, path := range ssiQuoteEndpoints {
		exchange, path := exchange, path
		g.Go(func() error {
			quotes, err := p.fetchExchange(gctx, exchange, path)
			if err != nil {
				return fmt.Errorf("fetch %s quotes: %w", exchange, err)
			}
			resultsCh <- quotes
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}
	close(resultsCh)

	for quotes := range resultsCh {
		results = append(results, quotes)
	}

	combined := make(map[string]marketvo.MarketQuote, 2000)
	for _, m := range results {
		for sym, q := range m {
			combined[sym] = q
		}
	}

	zap.L().Debug("SSI quotes fetched",
		zap.String("provider", ssiQuoteName),
		zap.Int("total_symbols", len(combined)),
	)

	return combined, nil
}

// fetchExchange fetches quotes for a single exchange path.
func (p *SSIQueryProvider) fetchExchange(ctx context.Context, exchange, path string) (out map[string]marketvo.MarketQuote, err error) {
	tracker := p.metrics.BeginRequest(ssiQuoteName)
	defer func() {
		tracker.EndRequest(err, errors.Is(err, contract.ErrRateLimited), 0)
	}()

	url := p.baseURL + path

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	// Cloudflare binds cf_clearance to the exact request fingerprint that minted it
	// (browser top-level navigation: text/html Accept, no Origin/Referer). Any
	// deviation triggers 403 even with a valid token. Refresh cookie by repeating
	// a browser navigation to this URL and re-pasting the cf_clearance value.
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Cache-Control", "max-age=0")
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36")
	req.Header.Set("Cookie", "cf_clearance=QNChFLMM7yp3df7d8sQiP8UBK_2gsFqkvTdTuSGdqcE-1778826411-1.2.1.1-lv2OxU.clmM1lovkYrGMgdsGiwGgdnij4hpApjDLtFkDTGO1U5_4JLJcf5Wx3uqEa1oJOwk5hZYlgBNmzxZJjTo.5Y31CQkUNKuvfggQym_UN.axaNtOP1NMGJhfMzpd.M8.j3rALnmDRfVDdYCdXBIfIkiexpbRuUS82VdDCFNRZIpKqHE3lnXB1yphADrsfsuRKRHyoNm35WmW5ybwjeEyDpV96PFWyrk_LFdIs7VZG5m0kr_l9qDJNTKPaDKKBViLMsRsPMKpRaK919LbC.QuRsZxMNaHGIchQB4skfz1Q2xWD2isBQfUoUCdjJyWZkaDNO83zKpip9j0jQ7vcLr.7srVFSS5ZxvT5oDS8rmLWwpBkbRqGllYf88J72be90fRc9bbTSKVRathyFbqx6OCroBrY1FT8JHEFqKhdB0")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if err = HandleHTTPError(resp, body, ssiQuoteName); err != nil {
		return nil, err
	}

	var quoteResp ssiQuoteResponse
	if err = json.Unmarshal(body, &quoteResp); err != nil {
		return nil, fmt.Errorf("parse quote response: %w", err)
	}

	if quoteResp.Code != "" && quoteResp.Code != "SUCCESS" {
		err = fmt.Errorf("SSI iboard-query error: code=%s, message=%s", quoteResp.Code, quoteResp.Message)
		return nil, err
	}

	out = make(map[string]marketvo.MarketQuote, len(quoteResp.Data))
	for _, item := range quoteResp.Data {
		if item.StockSymbol == "" {
			continue
		}
		out[item.StockSymbol] = marketvo.MarketQuote{
			Symbol:           item.StockSymbol,
			MatchedPrice:     item.MatchedPrice,
			TotalTradedQty:   item.NmTotalTradedQty,
			TotalTradedValue: item.NmTotalTradedValue,
			PriceChange:      item.PriceChange,
			PriceChangePct:   item.PriceChangePercent,
			RefPrice:         item.RefPrice,
			Ceiling:          item.Ceiling,
			Floor:            item.Floor,
			Highest:          item.Highest,
			Lowest:           item.Lowest,
			AvgPrice:         item.AvgPrice,
			Best1Bid:         item.Best1Bid,
			Best1BidVol:      item.Best1BidVol,
			Best1Offer:       item.Best1Offer,
			Best1OfferVol:    item.Best1OfferVol,
			Best2Bid:         item.Best2Bid,
			Best2BidVol:      item.Best2BidVol,
			Best2Offer:       item.Best2Offer,
			Best2OfferVol:    item.Best2OfferVol,
			Best3Bid:         item.Best3Bid,
			Best3BidVol:      item.Best3BidVol,
			Best3Offer:       item.Best3Offer,
			Best3OfferVol:    item.Best3OfferVol,
			TradingDate:      item.TradingDate,
			Exchange:         item.Exchange,
		}
	}

	zap.L().Debug("SSI exchange quotes fetched",
		zap.String("exchange", exchange),
		zap.Int("symbols", len(out)),
	)

	return out, nil
}
