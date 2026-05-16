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

	ssiUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"

	// Cloudflare session cookies. Capture all three from the same VNC
	// browser session in DevTools → Application → Cookies → ssi.com.vn.
	// The jar auto-rotates __cf_bm and _cfuvid from each response's
	// Set-Cookie, so manual refresh = re-paste cf_clearance plus the
	// companion pair from the same capture.
	ssiCFClearance = "z11gcZnMxZ6ZYFxdlvBXtAGAlOsG.h5lwYp2PhpvLdo-1778903597-1.2.1.1-uDfnZxFoYT2uNN0oGhMLcS.THYgKa.SLJmL.z2ho7AblmnU9pYFJmE8PxtAyCP4G5KFrlTdbnl9qFRfguIusUzL5NlAF_6rvB1D7oPDuWyftXVOTcMiYt6oWJMuIswd9m3VcEp37hZV3BgaWP9LGVJcD77hxiG38n2y1kqtz146EjZmtKjw4R87ApsVJM8DLgKVcHCKvxXzYxVMiGNbKJdQ7qpSK87yCyQlbxktnxB4bF8_bXwPX6K5JXo0_5PpcYg9QK1GVsVNoOLE0Gd4JPOHbR6illa3K_qUPfn2JpLlfITThJ_cA9oybGPw32khihGwbTXEhJhV9PDL4qkmO7_OK4rT5nWllEna9rjbzv_Uy5NvQiCWHwKkLRo8kUXMBq7pwZXkk7t64HttA.OpMyCj670V2tTutwNd9XoXfIp4"
	ssiCFBm        = "Bj7wN9SQTsuuNZVyr5EKIXEzgxkTheYlJbLcaT0Zflw-1778903596.9944515-1.0.1.1-jIpUu_Vu7bpM0Bv2jmqSb_jULTO7SRQk0ScxEIlrGG4ocMmtEYGnSws8iu0cdWkDllE0TKbckhQbGuRZI6aI6w707D_CIrz4fefbRYpFeGtVKxWoTnXvyDvrAD5mqz_M"
	ssiCFUvid      = "fpoRDKk4Fl8wBSq5PR2eM6KAbWZbAzK5GbrmsezndHE-1778815413.341835-1.0.1.1-1xfahiOZ96hLlBqRzXOTOCaN8l0vZrc3f7u7c2x1tfQ"
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

	jar, err := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
	if err != nil {
		return nil, fmt.Errorf("ssi-quote: build cookie jar: %w", err)
	}
	if err := seedSSICookies(jar); err != nil {
		return nil, fmt.Errorf("ssi-quote: seed cookies: %w", err)
	}

	// Shallow-copy the shared client to attach a private jar without
	// leaking SSI cookies into other providers that share the transport.
	clientCopy := *client
	clientCopy.Jar = jar

	m.InitProvider(ssiQuoteName, 0)
	return &SSIQueryProvider{
		client:  &clientCopy,
		baseURL: ssiQuoteBaseURL,
		metrics: m,
	}, nil
}

// seedSSICookies installs the captured Cloudflare session into the jar.
// Empty values are skipped so the bot can run with only cf_clearance until
// the companion cookies are pasted from the same VNC capture.
func seedSSICookies(jar http.CookieJar) error {
	u, err := url.Parse(ssiQuoteBaseURL)
	if err != nil {
		return fmt.Errorf("parse base url: %w", err)
	}
	seeds := []*http.Cookie{
		{Name: "cf_clearance", Value: ssiCFClearance, Domain: ssiCookieDomain, Path: "/", Secure: true, HttpOnly: true},
		{Name: "__cf_bm", Value: ssiCFBm, Domain: ssiCookieDomain, Path: "/", Secure: true, HttpOnly: true},
		{Name: "_cfuvid", Value: ssiCFUvid, Domain: ssiCookieDomain, Path: "/", Secure: true, HttpOnly: true},
	}
	cookies := make([]*http.Cookie, 0, len(seeds))
	for _, c := range seeds {
		if c.Value == "" {
			continue
		}
		cookies = append(cookies, c)
	}
	jar.SetCookies(u, cookies)
	return nil
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
	// deviation triggers 403 even with a valid token. The client's cookie jar
	// (seeded in NewSSIQueryProvider) attaches cf_clearance on send and persists
	// __cf_bm / _cfuvid rotations from each response's Set-Cookie.
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Cache-Control", "max-age=0")
	req.Header.Set("User-Agent", ssiUserAgent)

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
