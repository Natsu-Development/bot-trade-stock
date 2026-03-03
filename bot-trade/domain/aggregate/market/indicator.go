package market

// PriceDataWithRSI is PriceData enriched with RSI value.
type PriceDataWithRSI struct {
	Index int
	Date  string
	Close float64
	RSI   float64
}
