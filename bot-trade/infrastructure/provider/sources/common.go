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
// Returns ErrRateLimited for 429, ErrForbidden for 403, or a generic error with status and body for other non-200 responses.
// Returns nil if status is 200 OK.
func HandleHTTPError(resp *http.Response, body []byte, providerName string) error {
	if resp.StatusCode == http.StatusTooManyRequests {
		return fmt.Errorf("%s: %w", providerName, contract.ErrRateLimited)
	}

	if resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("%s: %w", providerName, contract.ErrForbidden)
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

// priceNormalizationThreshold is the threshold above which prices are considered
// to be in actual VND and need to be normalized to thousands of VND.
// Vietnamese stocks typically trade below 1000 (thousands of VND).
// If prices are above this threshold, they're likely in actual VND (e.g., 82100 instead of 82.1).
const priceNormalizationThreshold = 10000.0

// needsPriceNormalization checks if prices need to be normalized from actual VND to thousands of VND.
// Returns true if the median price is above the threshold, indicating prices are in actual VND.
func needsPriceNormalization(prices []float64) bool {
	if len(prices) == 0 {
		return false
	}

	// Use the first close price as a sample
	// If it's above the threshold, prices are likely in actual VND
	samplePrice := prices[0]
	return samplePrice > priceNormalizationThreshold
}

// normalizePrices converts prices from actual VND to thousands of VND if needed.
// This ensures consistent price format across all providers.
// Example: 82100 VND -> 82.1 (thousands of VND)
func normalizePrices(prices []float64) []float64 {
	if !needsPriceNormalization(prices) {
		return prices
	}

	normalized := make([]float64, len(prices))
	for i, p := range prices {
		normalized[i] = p / 1000.0
	}
	return normalized
}

// TransformOHLCV converts normalized OHLCV data to MarketData slice.
// Automatically normalizes prices from actual VND to thousands of VND if needed.
func TransformOHLCV(data OHLCVData) []marketvo.MarketData {
	n := len(data.Timestamps)
	if n == 0 {
		return nil
	}
	if len(data.Opens) != n || len(data.Highs) != n || len(data.Lows) != n || len(data.Closes) != n {
		return nil
	}

	// Normalize prices if they appear to be in actual VND
	opens := normalizePrices(data.Opens)
	highs := normalizePrices(data.Highs)
	lows := normalizePrices(data.Lows)
	closes := normalizePrices(data.Closes)

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
			Open:   opens[i],
			High:   highs[i],
			Low:    lows[i],
			Close:  closes[i],
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
