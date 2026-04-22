package sources

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"bot-trade/application/port/outbound"
	marketvo "bot-trade/domain/shared/valueobject/market"
	"bot-trade/infrastructure/provider/contract"
	"bot-trade/infrastructure/provider/registry"
)

const (
	vpsName         = "vps"
	vpsHistBaseURL  = "https://histdatafeed.vps.com.vn/tradingview"
	vpsStockListURL = "https://bgapidatafeed.vps.com.vn/getlistallstock"
)

func init() {
	registry.RegisterFactory(vpsName, NewVPS)
}

// Verify interface compliance at compile time.
var _ contract.Provider = (*VPSProvider)(nil)
var _ outbound.StockLister = (*VPSProvider)(nil)

// vpsChartResponse is the TradingView-compatible response from VPS history API.
type vpsChartResponse struct {
	Timestamps []int64   `json:"t"` // Unix timestamps
	Opens      []float64 `json:"o"` // Open prices
	Highs      []float64 `json:"h"` // High prices
	Lows       []float64 `json:"l"` // Low prices
	Closes     []float64 `json:"c"` // Close prices
	Volumes    []int64   `json:"v"` // Volumes
	Status     string    `json:"s"` // Status ("ok" or error)
}

// vpsStockItem represents a stock in the VPS list response.
type vpsStockItem struct {
	StockCode string `json:"stock_code"` // Symbol
	NameVN    string `json:"name_vn"`    // Vietnamese name
	NameEN    string `json:"name_en"`    // English name
	NameShort string `json:"name_short"` // Short name
	PostTo    string `json:"post_to"`    // Exchange (HNX, HOSE, UPCOM)
	C         int    `json:"C"`          // Unknown field
	Type      string `json:"type"`       // Stock type
}

// VPSProvider implements Provider using VPS TradingView-compatible API.
type VPSProvider struct {
	client *http.Client
}

// NewVPS creates a new VPS provider.
func NewVPS(client *http.Client) contract.Provider {
	return &VPSProvider{
		client: client,
	}
}

// Name returns the provider name.
func (p *VPSProvider) Name() string { return vpsName }

// FetchBars fetches OHLCV bars from VPS TradingView-compatible API.
func (p *VPSProvider) FetchBars(
	ctx context.Context,
	q marketvo.MarketDataQuery,
) ([]marketvo.MarketData, error) {
	url := fmt.Sprintf("%s/history?symbol=%s&resolution=%s&from=%d&to=%d",
		vpsHistBaseURL,
		q.Symbol,
		MapIntervalToTradingView(string(q.Interval)),
		q.StartDate.Unix(),
		q.EndDate.Add(24*time.Hour).Unix(),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	p.setDefaultHeaders(req)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if err := HandleHTTPError(resp, body, vpsName); err != nil {
		return nil, err
	}

	var chartResp vpsChartResponse
	if err := json.Unmarshal(body, &chartResp); err != nil {
		return nil, fmt.Errorf("failed to parse chart response: %w", err)
	}

	if chartResp.Status != "ok" {
		return nil, fmt.Errorf("vps: %w", contract.ErrNoData)
	}

	result := TransformOHLCV(OHLCVData{
		Timestamps: chartResp.Timestamps,
		Opens:      chartResp.Opens,
		Highs:      chartResp.Highs,
		Lows:       chartResp.Lows,
		Closes:     chartResp.Closes,
		Volumes:    chartResp.Volumes,
	})

	return result, nil
}

// ListAllStocks fetches all stocks from VPS API.
func (p *VPSProvider) ListAllStocks(ctx context.Context) ([]marketvo.StockInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, vpsStockListURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	p.setDefaultHeaders(req)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if err := HandleHTTPError(resp, body, vpsName); err != nil {
		return nil, err
	}

	var stockResp []vpsStockItem
	if err := json.Unmarshal(body, &stockResp); err != nil {
		return nil, fmt.Errorf("failed to parse stock list response: %w", err)
	}

	stocks := make([]marketvo.StockInfo, 0, len(stockResp))
	for _, s := range stockResp {
		sym, err := marketvo.NewSymbol(s.StockCode)
		if err != nil {
			continue
		}

		exchange := normalizeVPSExchange(s.PostTo)
		exch, err := marketvo.NewExchange(exchange)
		if err != nil {
			continue
		}

		stocks = append(stocks, marketvo.StockInfo{
			Symbol:   sym,
			Exchange: exch,
			Name:     s.NameVN,
		})
	}

	return stocks, nil
}

// setDefaultHeaders sets the required HTTP headers for VPS API requests.
func (p *VPSProvider) setDefaultHeaders(req *http.Request) {
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
}

// normalizeVPSExchange normalizes exchange names to standard format (HOSE, HNX, UPCOM).
func normalizeVPSExchange(exchange string) string {
	switch exchange {
	case "HOSE", "hose":
		return "HOSE"
	case "HNX", "hnx":
		return "HNX"
	case "UPCOM", "upcom":
		return "UPCOM"
	default:
		return exchange
	}
}
