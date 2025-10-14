package entities

// PivotPoint represents a detected pivot in price or RSI data
type PivotPoint struct {
	Index      int
	Value      float64
	Price      float64 // Corresponding price at this RSI pivot
	RSI        float64 // Corresponding RSI at this price pivot
	Date       string
	IsPeakHigh bool // true for pivot high, false for pivot low
}

// PriceRSINode represents a data point with price, RSI, and metadata
type PriceRSINode struct {
	Index          int
	Date           string
	Price          float64
	RSIValue       float64
	IsOptimalPoint bool
}
