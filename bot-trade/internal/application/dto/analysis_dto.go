package dto

import "time"

// DivergenceDTO represents divergence data for API responses
type DivergenceDTO struct {
	Type            string    `json:"type"`
	Description     string    `json:"description"`
	DivergenceFound bool      `json:"divergence_found"`
	CurrentPrice    float64   `json:"current_price"`
	CurrentRSI      float64   `json:"current_rsi"`
	DetectedAt      time.Time `json:"detected_at"`
	TradingSignal   string    `json:"trading_signal"`
}

// AnalysisRequest represents a request for stock analysis
type AnalysisRequest struct {
	Symbol    string `json:"symbol" binding:"required"`
	StartDate string `json:"start_date"` // Format: YYYY-MM-DD, optional
	EndDate   string `json:"end_date"`   // Format: YYYY-MM-DD, optional (default: today)
	Interval  string `json:"interval"`   // Data interval: "1d", "1h", "15m", etc. (default: "1d")
}

// DivergenceAnalysisResponse represents the response for divergence analysis
type DivergenceAnalysisResponse struct {
	Symbol           string         `json:"symbol"`
	Divergence       *DivergenceDTO `json:"divergence"`
	ProcessingTimeMs int64          `json:"processing_time_ms"`
	Parameters       *ParametersDTO `json:"parameters"`
	Timestamp        string         `json:"timestamp"`
}

// ParametersDTO represents analysis parameters
type ParametersDTO struct {
	StartDate string `json:"start_date,omitempty"` // Format: YYYY-MM-DD
	EndDate   string `json:"end_date,omitempty"`   // Format: YYYY-MM-DD
	Interval  string `json:"interval,omitempty"`   // Data interval
	RSIPeriod int    `json:"rsi_period"`
}
