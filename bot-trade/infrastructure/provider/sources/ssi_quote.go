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
	"net/http/cookiejar"
	"net/url"

	"bot-trade/infrastructure/credentials"
	"bot-trade/infrastructure/metrics"
	"bot-trade/infrastructure/provider/contract"

	marketvo "bot-trade/domain/shared/valueobject/market"

	"go.uber.org/zap"
	"golang.org/x/net/publicsuffix"
	"golang.org/x/sync/errgroup"
)

const (
	ssiQuoteName    = "ssi-quote"
	ssiQuoteBaseURL = "https://iboard-query.ssi.com.vn"
	ssiCookieDomain = ".ssi.com.vn"

	// defaultUserAgent is used when no credential snapshot/user-agent is available.
	// Keeps the request browser-like even without minted credentials.
	defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
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
	StockSymbol        string  `json:"stockSymbol"`
	MatchedPrice       float64 `json:"matchedPrice"`
	NmTotalTradedQty   int64   `json:"nmTotalTradedQty"`
	NmTotalTradedValue float64 `json:"nmTotalTradedValue"`
	PriceChange        float64 `json:"priceChange"`
	PriceChangePercent float64 `json:"priceChangePercent"`
	RefPrice           float64 `json:"refPrice"`
	Ceiling            float64 `json:"ceiling"`
	Floor              float64 `json:"floor"`
	Highest            float64 `json:"highest"`
	Lowest             float64 `json:"lowest"`
	AvgPrice           float64 `json:"avgPrice"`
	Best1Bid           float64 `json:"best1Bid"`
	Best1BidVol        int64   `json:"best1BidVol"`
	Best1Offer         float64 `json:"best1Offer"`
	Best1OfferVol      int64   `json:"best1OfferVol"`
	Best2Bid           float64 `json:"best2Bid"`
	Best2BidVol        int64   `json:"best2BidVol"`
	Best2Offer         float64 `json:"best2Offer"`
	Best2OfferVol      int64   `json:"best2OfferVol"`
	Best3Bid           float64 `json:"best3Bid"`
	Best3BidVol        int64   `json:"best3BidVol"`
	Best3Offer         float64 `json:"best3Offer"`
	Best3OfferVol      int64   `json:"best3OfferVol"`
	TradingDate        string  `json:"tradingDate"`
	Exchange           string  `json:"exchange"`
}

// credentialStore is a consumer-side interface — the SSI provider only needs the
// current snapshot, nothing else. Kept narrow here (in the consumer package) so
// the credentials package owns its API surface and tests can stub easily.
type credentialStore interface {
	Current() credentials.SSICredentials
}

// SSIQueryProvider fetches real-time quotes from SSI iboard-query API.
// Standalone — does NOT implement contract.Provider (which serves OHLCV charts).
// Observed via ProviderMetrics so dashboards see request rate / latency / errors
// for quote-fetches under {provider="ssi-quote"}.
type SSIQueryProvider struct {
	client    *http.Client
	baseURL   string
	metrics   *metrics.ProviderMetrics
	credStore credentialStore
}

// NewSSIQueryProvider creates a new SSI iboard-query adapter.
// The credential store is optional so non-production wiring can skip credential
// refresh code entirely and send quote requests without Cloudflare cookies.
func NewSSIQueryProvider(client *http.Client, m *metrics.ProviderMetrics, store credentialStore) (*SSIQueryProvider, error) {
	if client == nil {
		return nil, fmt.Errorf("ssi-quote: http client is required")
	}
	if m == nil {
		return nil, fmt.Errorf("ssi-quote: provider metrics is required")
	}
	m.InitProvider(ssiQuoteName, 0)
	return &SSIQueryProvider{
		client:    client,
		baseURL:   ssiQuoteBaseURL,
		metrics:   m,
		credStore: store,
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
// A fresh cookiejar.Jar is built on every call so the 3 parallel exchange
// goroutines do not share mutable jar state, and each call picks up the
// latest credentials from the atomic credStore snapshot when one is configured.
func (p *SSIQueryProvider) fetchExchange(ctx context.Context, exchange, path string) (out map[string]marketvo.MarketQuote, err error) {
	tracker := p.metrics.BeginRequest(ssiQuoteName)
	defer func() {
		tracker.EndRequest(err, errors.Is(err, contract.ErrRateLimited), 0)
	}()

	// Snapshot credentials once; all header/cookie writes use this value.
	// Non-production may have no credential store, in which case zero-value
	// credentials intentionally produce no Cloudflare cookies.
	var creds credentials.SSICredentials
	if p.credStore != nil {
		creds = p.credStore.Current()
	}

	// Build a per-call jar so concurrent goroutines cannot observe each
	// other's Set-Cookie rotations, and each call starts from the live snapshot.
	jar, err := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
	if err != nil {
		return nil, fmt.Errorf("build cookie jar: %w", err)
	}
	u, err := url.Parse(ssiQuoteBaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse base url: %w", err)
	}
	seeds := []*http.Cookie{
		{Name: "cf_clearance", Value: creds.CFClearance, Domain: ssiCookieDomain, Path: "/", Secure: true, HttpOnly: true},
		{Name: "__cf_bm", Value: creds.CFBm, Domain: ssiCookieDomain, Path: "/", Secure: true, HttpOnly: true},
		{Name: "_cfuvid", Value: creds.CFUvid, Domain: ssiCookieDomain, Path: "/", Secure: true, HttpOnly: true},
	}
	nonEmpty := make([]*http.Cookie, 0, len(seeds))
	for _, c := range seeds {
		if c.Value != "" {
			nonEmpty = append(nonEmpty, c)
		}
	}
	jar.SetCookies(u, nonEmpty)

	// Shallow-copy the shared client to attach the per-call jar while
	// preserving the retry transport and its 429 back-off behaviour.
	callClient := *p.client
	callClient.Jar = jar

	reqURL := p.baseURL + path
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	// Cloudflare binds cf_clearance to the exact request fingerprint that minted it
	// (browser top-level navigation: text/html Accept, no Origin/Referer). Any
	// deviation triggers 403 even with a valid token. The jar above attaches
	// cf_clearance on send and persists __cf_bm / _cfuvid from each Set-Cookie.
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Cache-Control", "max-age=0")
	userAgent := creds.UserAgent
	if userAgent == "" {
		userAgent = defaultUserAgent
	}
	req.Header.Set("User-Agent", userAgent)
	// Browser client hints + fetch metadata. CF accumulates samples on requests
	// missing these and flags after a few hours of identical traffic. Values
	// must match the User-Agent (Chrome 148, Linux, desktop, navigation context).
	req.Header.Set("Sec-Ch-Ua", `"Not.A/Brand";v="99", "Chromium";v="148", "Google Chrome";v="148"`)
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", `"Linux"`)
	req.Header.Set("Sec-Fetch-Site", "none")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-User", "?1")
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Upgrade-Insecure-Requests", "1")

	resp, err := callClient.Do(req)
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
