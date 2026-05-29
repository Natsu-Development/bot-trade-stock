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

// priceNormalizationThreshold separates raw VND from kVND (thousands of VND).
// No listed Vietnamese equity trades at or above 1,000 kVND (= 1,000,000 VND
// per share), so any price >= 1,000 must be raw VND and is divided to kVND;
// anything below 1,000 is already kVND and passes through. This boundary makes
// the bar path self-correct whether a provider returns raw VND or kVND — the two
// scales do not overlap around 1,000.
//
// This is bar-only: the OHLCV path is shared across providers (SSI/VPS/VietCap)
// whose raw-vs-kVND scale is not uniformly verified, so unconditional division
// would 1000x-corrupt any provider already returning kVND. (The quote path uses
// a single verified adapter, normalizedQuoteFromItem, that divides unconditionally.)
const priceNormalizationThreshold = 1000.0

// needsPriceNormalization reports whether a per-symbol bar array is in raw VND
// (and must be divided by 1000). It tests the largest price in the array: zero
// and NaN values from corrupted leading bars never raise the max, so they cannot
// force a false negative.
func needsPriceNormalization(prices []float64) bool {
	var maxPrice float64
	for _, p := range prices {
		if p > maxPrice {
			maxPrice = p
		}
	}
	return maxPrice >= priceNormalizationThreshold
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
