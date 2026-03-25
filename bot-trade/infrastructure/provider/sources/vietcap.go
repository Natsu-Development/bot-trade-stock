package sources

import (
	"bytes"
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
	vietcapName    = "vietcap"
	vietcapBaseURL = "https://trading.vietcap.com.vn/api"
)

func init() {
	registry.RegisterFactory(vietcapName, NewVietCap)
}

// Verify interface compliance at compile time.
var _ contract.Provider = (*VietCapProvider)(nil)

// vietcapOHLCRequest is the request body for OHLC chart data.
type vietcapOHLCRequest struct {
	TimeFrame string   `json:"timeFrame"`
	Symbols   []string `json:"symbols"`
	From      int64    `json:"from"`
	To        int64    `json:"to"`
}

// vietcapOHLCItem represents a single stock's OHLC data in the response.
type vietcapOHLCItem struct {
	Symbol string    `json:"symbol"`
	O      []float64 `json:"o"` // Open prices
	H      []float64 `json:"h"` // High prices
	L      []float64 `json:"l"` // Low prices
	C      []float64 `json:"c"` // Close prices
	V      []int64   `json:"v"` // Volume
	T      []string  `json:"t"` // Timestamps as strings
}

// VietCapProvider implements Provider using VietCap Trading API.
type VietCapProvider struct {
	client  *http.Client
	baseURL string
}

// NewVietCap creates a new VietCap provider.
func NewVietCap(client *http.Client) contract.Provider {
	return &VietCapProvider{
		client:  client,
		baseURL: vietcapBaseURL,
	}
}

// Name returns the provider name.
func (p *VietCapProvider) Name() string { return vietcapName }

// FetchBars fetches OHLCV bars from VietCap Trading API.
func (p *VietCapProvider) FetchBars(
	ctx context.Context,
	q marketvo.MarketDataQuery,
) ([]marketvo.MarketData, error) {
	reqBody := vietcapOHLCRequest{
		TimeFrame: mapIntervalToVietCapTimeFrame(string(q.Interval)),
		Symbols:   []string{string(q.Symbol)},
		From:      q.StartDate.Unix(),
		To:        q.EndDate.Add(24 * time.Hour).Unix(),
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/chart/OHLCChart/gap", p.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
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

	if err := HandleHTTPError(resp, body, vietcapName); err != nil {
		return nil, err
	}

	var ohlcItems []vietcapOHLCItem
	if err := json.Unmarshal(body, &ohlcItems); err != nil {
		return nil, fmt.Errorf("failed to parse OHLCV response: %w", err)
	}

	if len(ohlcItems) == 0 {
		return nil, nil
	}

	timestamps, err := ParseStringTimestamps(ohlcItems[0].T)
	if err != nil {
		return nil, fmt.Errorf("failed to parse timestamps: %w", err)
	}

	result := TransformOHLCV(OHLCVData{
		Timestamps: timestamps,
		Opens:      ohlcItems[0].O,
		Highs:      ohlcItems[0].H,
		Lows:       ohlcItems[0].L,
		Closes:     ohlcItems[0].C,
		Volumes:    ohlcItems[0].V,
	})

	zap.L().Debug("FetchBars data",
		zap.String("provider", vietcapName),
		zap.String("symbol", string(q.Symbol)),
		zap.String("interval", string(q.Interval)),
		zap.Int("bars", len(result)),
	)

	return result, nil
}

// setDefaultHeaders sets the required HTTP headers for VietCap API requests.
func (p *VietCapProvider) setDefaultHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Origin", "https://trading.vietcap.com.vn")
	req.Header.Set("Referer", "https://trading.vietcap.com.vn/")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
}

// mapIntervalToVietCapTimeFrame maps domain interval to VietCap timeFrame.
func mapIntervalToVietCapTimeFrame(interval string) string {
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
