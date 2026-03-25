package sources

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	marketvo "bot-trade/domain/shared/valueobject/market"
	"bot-trade/infrastructure/provider/contract"
)

// HandleHTTPError checks for common HTTP errors and returns appropriate errors.
// Returns ErrRateLimited for 429, or a generic error with status and body for other non-200 responses.
// Returns nil if status is 200 OK.
func HandleHTTPError(resp *http.Response, body []byte, providerName string) error {
	if resp.StatusCode == http.StatusTooManyRequests {
		return fmt.Errorf("%s: %w", providerName, contract.ErrRateLimited)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s API error: status=%d, body=%s", providerName, resp.StatusCode, string(body))
	}

	return nil
}

// MapIntervalToTradingView maps domain interval to TradingView resolution format.
// Used by SSI and VPS providers which both use TradingView-compatible APIs.
func MapIntervalToTradingView(interval string) string {
	switch interval {
	case "1m":
		return "1"
	case "5m":
		return "5"
	case "15m":
		return "15"
	case "30m":
		return "30"
	case "1H":
		return "60"
	case "4H":
		return "240"
	case "1D":
		return "D"
	case "1W":
		return "W"
	case "1M":
		return "M"
	default:
		return "D"
	}
}

// OHLCVData holds normalized OHLCV data for transformation.
type OHLCVData struct {
	Timestamps []int64
	Opens      []float64
	Highs      []float64
	Lows       []float64
	Closes     []float64
	Volumes    []int64
}

// TransformOHLCV converts normalized OHLCV data to MarketData slice.
func TransformOHLCV(data OHLCVData) []marketvo.MarketData {
	n := len(data.Timestamps)
	if n == 0 {
		return nil
	}
	if len(data.Opens) != n || len(data.Highs) != n || len(data.Lows) != n || len(data.Closes) != n {
		return nil
	}

	result := make([]marketvo.MarketData, 0, n)
	for i := 0; i < n; i++ {
		t := time.Unix(data.Timestamps[i], 0)
		var volume int64
		if i < len(data.Volumes) {
			volume = data.Volumes[i]
		}
		result = append(result, marketvo.MarketData{
			Index:  i,
			Date:   t.Format("2006-01-02"),
			Open:   data.Opens[i],
			High:   data.Highs[i],
			Low:    data.Lows[i],
			Close:  data.Closes[i],
			Volume: volume,
		})
	}
	return result
}

// ParseStringTimestamps converts string timestamps to int64 (for VietCap).
func ParseStringTimestamps(timestamps []string) ([]int64, error) {
	result := make([]int64, len(timestamps))
	for i, ts := range timestamps {
		parsed, err := strconv.ParseInt(ts, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid timestamp at index %d: %w", i, err)
		}
		result[i] = parsed
	}
	return result, nil
}
