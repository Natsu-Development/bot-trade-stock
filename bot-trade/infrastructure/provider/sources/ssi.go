package sources

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	marketvo "bot-trade/domain/shared/valueobject/market"
	"bot-trade/infrastructure/provider/contract"
	"bot-trade/infrastructure/provider/registry"

	"go.uber.org/zap"
)

const (
	ssiName    = "ssi"
	ssiBaseURL = "https://iboard-api.ssi.com.vn"
)

func init() {
	registry.RegisterFactory(ssiName, NewSSI)
}

// Verify interface compliance at compile time.
var _ contract.Provider = (*SSIProvider)(nil)

// ssiChartResponse is the top-level response from SSI chart API.
type ssiChartResponse struct {
	Code    string       `json:"code"`
	Message string       `json:"message"`
	Data    ssiChartData `json:"data"`
}

// ssiChartData contains the OHLCV data from SSI API.
type ssiChartData struct {
	Timestamps []int64   `json:"t"` // Unix timestamps
	Opens      []float64 `json:"o"`
	Highs      []float64 `json:"h"`
	Lows       []float64 `json:"l"`
	Closes     []float64 `json:"c"`
	Volumes    []int64   `json:"v"`
	Status     string    `json:"s"`
	NextTime   *int64    `json:"nextTime"`
}

// SSIProvider implements Provider using SSI iBoard API.
type SSIProvider struct {
	client  *http.Client
	baseURL string
}

// NewSSI creates a new SSI provider.
func NewSSI(client *http.Client) contract.Provider {
	return &SSIProvider{
		client:  client,
		baseURL: ssiBaseURL,
	}
}

// Name returns the provider name.
func (p *SSIProvider) Name() string { return ssiName }

// FetchBars fetches OHLCV bars from SSI iBoard API.
func (p *SSIProvider) FetchBars(
	ctx context.Context,
	q marketvo.MarketDataQuery,
) ([]marketvo.MarketData, error) {
	url := fmt.Sprintf("%s/statistics/charts/history?resolution=%s&symbol=%s&from=%d&to=%d",
		p.baseURL,
		MapIntervalToTradingView(string(q.Interval)),
		q.Symbol,
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

	if err := HandleHTTPError(resp, body, ssiName); err != nil {
		return nil, err
	}

	var chartResp ssiChartResponse
	if err := json.Unmarshal(body, &chartResp); err != nil {
		return nil, fmt.Errorf("failed to parse chart response: %w", err)
	}

	if chartResp.Code != "SUCCESS" {
		return nil, fmt.Errorf("SSI API returned error: code=%s, message=%s", chartResp.Code, chartResp.Message)
	}

	result := TransformOHLCV(OHLCVData{
		Timestamps: chartResp.Data.Timestamps,
		Opens:      chartResp.Data.Opens,
		Highs:      chartResp.Data.Highs,
		Lows:       chartResp.Data.Lows,
		Closes:     chartResp.Data.Closes,
		Volumes:    chartResp.Data.Volumes,
	})

	zap.L().Debug("FetchBars data",
		zap.String("provider", ssiName),
		zap.String("symbol", string(q.Symbol)),
		zap.String("interval", string(q.Interval)),
		zap.Int("bars", len(result)),
	)

	return result, nil
}

// setDefaultHeaders sets the required HTTP headers for SSI API requests.
func (p *SSIProvider) setDefaultHeaders(req *http.Request) {
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
}

