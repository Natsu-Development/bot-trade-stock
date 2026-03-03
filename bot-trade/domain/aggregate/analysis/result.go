package analysis

import "time"

// DivergencePoint represents a single point in the divergence pattern with price and date.
type DivergencePoint struct {
	Price float64
	Date  string
}

// AnalysisResult is the aggregate root for divergence analysis results.
type AnalysisResult struct {
	Symbol           string
	DivergenceType   DivergenceType
	DivergenceFound  bool
	CurrentPrice     float64
	CurrentRSI       float64
	Description      string
	ProcessingTimeMs int64
	StartDate        string
	EndDate          string
	Interval         string
	RSIPeriod        int
	Timestamp        time.Time
	// DivergencePoints: 2 points showing the divergence pattern
	// Point[0] = First pivot (older date, FROM)
	// Point[1] = Second pivot (newer date, TO)
	DivergencePoints [2]DivergencePoint
	// Early detection fields
	EarlySignalDetected bool
	EarlyDescription    string
}

// NewAnalysisResult creates a new AnalysisResult.
func NewAnalysisResult(
	symbol string,
	divergenceType DivergenceType,
	divergenceFound bool,
	currentPrice float64,
	currentRSI float64,
	description string,
	processingTimeMs int64,
	startDate string,
	endDate string,
	interval string,
	rsiPeriod int,
) *AnalysisResult {
	return &AnalysisResult{
		Symbol:           symbol,
		DivergenceType:   divergenceType,
		DivergenceFound:  divergenceFound,
		CurrentPrice:     currentPrice,
		CurrentRSI:       currentRSI,
		Description:      description,
		ProcessingTimeMs: processingTimeMs,
		StartDate:        startDate,
		EndDate:          endDate,
		Interval:         interval,
		RSIPeriod:        rsiPeriod,
		Timestamp:        time.Now(),
	}
}

// HasDivergence returns true if a divergence was detected.
func (r *AnalysisResult) HasDivergence() bool {
	return r.DivergenceFound
}

// SetEarlySignal sets the early detection fields.
func (r *AnalysisResult) SetEarlySignal(detected bool, description string) {
	r.EarlySignalDetected = detected
	r.EarlyDescription = description
}

// HasEarlySignal returns true if an early signal was detected.
func (r *AnalysisResult) HasEarlySignal() bool {
	return r.EarlySignalDetected
}

// SetDivergencePoints sets the divergence price points.
// point0 is the older pivot (FROM), point1 is the newer pivot (TO).
func (r *AnalysisResult) SetDivergencePoints(point0, point1 DivergencePoint) {
	r.DivergencePoints[0] = point0
	r.DivergencePoints[1] = point1
}

// HasDivergencePoints returns true if divergence points are set.
func (r *AnalysisResult) HasDivergencePoints() bool {
	return r.DivergencePoints[0].Price > 0 && r.DivergencePoints[1].Price > 0
}
