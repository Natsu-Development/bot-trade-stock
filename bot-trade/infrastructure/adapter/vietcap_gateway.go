package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"bot-trade/domain/aggregate/market"
	infraPort "bot-trade/infrastructure/port"
)

const (
	vietcapBaseURL   = "https://trading.vietcap.com.vn/api"
	defaultRateLimit = 15 // requests per minute
)

// VietCap API request/response structures (internal)

// vietcapOHLCRequest is the request body for OHLC chart data.
type vietcapOHLCRequest struct {
	TimeFrame string   `json:"timeFrame"`
	Symbols   []string `json:"symbols"`
	From      int64    `json:"from"`
	To        int64    `json:"to"`
}

// vietcapOHLCItem represents a single stock's OHLC data in the response.
// Note: timestamps are strings, prices can be integers or decimals.
type vietcapOHLCItem struct {
	Symbol string    `json:"symbol"`
	O      []float64 `json:"o"` // Open prices (VND, may have decimals)
	H      []float64 `json:"h"` // High prices (VND, may have decimals)
	L      []float64 `json:"l"` // Low prices (VND, may have decimals)
	C      []float64 `json:"c"` // Close prices (VND, may have decimals)
	V      []int64   `json:"v"` // Volume
	T      []string  `json:"t"` // Timestamps as strings!
}

// vietcapStockItem represents a stock in the list response.
type vietcapStockItem struct {
	Symbol string `json:"symbol"`
}

// VietCapGateway implements port.MarketDataGateway using VietCap Trading API.
type VietCapGateway struct {
	httpClient  *http.Client
	baseURL     string
	rateLimiter chan struct{}
}

// Verify interface compliance at compile time.
var _ infraPort.MarketDataGateway = (*VietCapGateway)(nil)

// NewVietCapGateway creates a new VietCap market data gateway.
// httpClient is the HTTP client to use for requests (should have retry transport configured).
// requestsPerMinute controls the rate limiting (default: 15).
func NewVietCapGateway(httpClient *http.Client, requestsPerMinute int) *VietCapGateway {
	if requestsPerMinute <= 0 {
		requestsPerMinute = defaultRateLimit
	}

	// Token bucket rate limiter
	rateLimiter := make(chan struct{}, requestsPerMinute)
	for i := 0; i < requestsPerMinute; i++ {
		rateLimiter <- struct{}{}
	}

	// Refill tokens periodically
	go func() {
		ticker := time.NewTicker(time.Minute / time.Duration(requestsPerMinute))
		defer ticker.Stop()
		for range ticker.C {
			select {
			case rateLimiter <- struct{}{}:
			default:
				// Bucket full, discard token
			}
		}
	}()

	return &VietCapGateway{
		httpClient:  httpClient,
		baseURL:     vietcapBaseURL,
		rateLimiter: rateLimiter,
	}
}

// FetchStockData fetches stock data from VietCap Trading API.
// Endpoint: POST /chart/OHLCChart/gap
func (g *VietCapGateway) FetchStockData(
	ctx context.Context,
	q market.MarketDataQuery,
) (*market.StockDataResponse, error) {
	// Wait for rate limit token
	select {
	case <-g.rateLimiter:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	// Convert dates to Unix timestamps
	startTime, err := time.Parse("2006-01-02", q.StartDate)
	if err != nil {
		return nil, fmt.Errorf("invalid start date: %w", err)
	}
	endTime, err := time.Parse("2006-01-02", q.EndDate)
	if err != nil {
		return nil, fmt.Errorf("invalid end date: %w", err)
	}

	// Build request body
	reqBody := vietcapOHLCRequest{
		TimeFrame: mapIntervalToTimeFrame(q.Interval),
		Symbols:   []string{q.Symbol},
		From:      startTime.Unix(),
		To:        endTime.Add(24 * time.Hour).Unix(), // Include end date
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Build request
	url := fmt.Sprintf("%s/chart/OHLCChart/gap", g.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set required headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Origin", "https://trading.vietcap.com.vn")
	req.Header.Set("Referer", "https://trading.vietcap.com.vn/")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("VietCap API error: status=%d, body=%s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Response is an array of OHLC items
	var ohlcItems []vietcapOHLCItem
	if err := json.Unmarshal(body, &ohlcItems); err != nil {
		return nil, fmt.Errorf("failed to parse OHLCV response: %w", err)
	}

	// Extract the first item (we only request one symbol)
	if len(ohlcItems) == 0 {
		return &market.StockDataResponse{
			Symbol:       q.Symbol,
			PriceHistory: nil,
		}, nil
	}

	// Transform VietCap data to domain PriceData
	priceHistory := g.transformOHLCV(ohlcItems[0])

	return &market.StockDataResponse{
		Symbol:       q.Symbol,
		PriceHistory: priceHistory,
	}, nil
}

// ListAllStocks fetches all stocks from VietCap Trading API.
// Endpoint: GET /price/symbols/getByGroup?group={exchange}
func (g *VietCapGateway) ListAllStocks(
	ctx context.Context,
	exchange string,
) (*market.ListStocksResponse, error) {
	// Wait for rate limit token
	select {
	case <-g.rateLimiter:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	url := fmt.Sprintf("%s/price/symbols/getByGroup?group=%s", g.baseURL, exchange)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set required headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Origin", "https://trading.vietcap.com.vn")
	req.Header.Set("Referer", "https://trading.vietcap.com.vn/")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("VietCap API error: status=%d, body=%s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Response is array of {symbol: "AAA"}
	var stockItems []vietcapStockItem
	if err := json.Unmarshal(body, &stockItems); err != nil {
		return nil, fmt.Errorf("failed to parse stock list response: %w", err)
	}

	// Transform to domain types
	stocks := make([]market.StockInfo, 0, len(stockItems))
	for _, s := range stockItems {
		stocks = append(stocks, market.StockInfo{
			Symbol:   s.Symbol,
			Exchange: exchange,
		})
	}

	return &market.ListStocksResponse{
		Stocks:     stocks,
		TotalCount: len(stocks),
	}, nil
}

// transformOHLCV converts VietCap OHLC item to domain PriceData slice.
// Handles string timestamps and float64 prices.
func (g *VietCapGateway) transformOHLCV(item vietcapOHLCItem) []*market.PriceData {
	n := len(item.T)
	if n == 0 {
		return nil
	}

	// Validate array lengths match
	if len(item.O) != n || len(item.H) != n || len(item.L) != n || len(item.C) != n {
		return nil
	}

	priceData := make([]*market.PriceData, n)
	for i := 0; i < n; i++ {
		// Parse string timestamp to int64
		timestamp, err := strconv.ParseInt(item.T[i], 10, 64)
		if err != nil {
			continue
		}
		t := time.Unix(timestamp, 0)

		var volume int64
		if i < len(item.V) {
			volume = item.V[i]
		}

		priceData[i] = &market.PriceData{
			Date:   t.Format("2006-01-02"),
			Open:   item.O[i],
			High:   item.H[i],
			Low:    item.L[i],
			Close:  item.C[i],
			Volume: volume,
		}
	}

	return priceData
}

// mapIntervalToTimeFrame maps domain interval to VietCap timeFrame.
func mapIntervalToTimeFrame(interval string) string {
	switch interval {
	case "1m":
		return "ONE_MINUTE"
	case "5m":
		return "FIVE_MINUTES"
	case "15m":
		return "FIFTEEN_MINUTES"
	case "30m":
		return "THIRTY_MINUTES"
	case "1H":
		return "ONE_HOUR"
	case "4H":
		return "FOUR_HOURS"
	case "1D":
		return "ONE_DAY"
	case "1W":
		return "ONE_WEEK"
	case "1M":
		return "ONE_MONTH"
	default:
		return "ONE_DAY"
	}
}
