package trendline

import (
	"backend/application/dto"
	appPrep "backend/application/usecase/analyze/prep"
	analysisservice "backend/domain/analysis/service"
	analysisvo "backend/domain/analysis/valueobject"
)

// BreakdownUseCase detects support trendline signals (Bounce).
// Pure analysis use case - receives prepared data, no I/O dependencies.
// Used for detecting potential bounce signals from support trendlines.
type BreakdownUseCase struct{}

// NewBreakdownUseCase creates a new breakdown use case.
func NewBreakdownUseCase() *BreakdownUseCase {
	return &BreakdownUseCase{}
}

// Execute performs support trendline analysis on prepared data.
// Pure analysis - no I/O, receives prepared data directly.
// Detects Bounce signals from support trendlines.
func (uc *BreakdownUseCase) Execute(prepared *appPrep.DataPrepare) ([]dto.TrendlineDTO, []dto.SignalDTO, error) {
	// Call domain services directly
	pivotPeriod := int(prepared.Config.PivotPeriod)

	// Find price low pivots for support trendlines
	priceLowPivots := analysisservice.FindLowPivots(prepared.Data, analysisvo.FieldLow, pivotPeriod)

	// Build support trendlines
	trendlines := analysisservice.BuildSupportTrendlines(priceLowPivots, prepared.Config.Trendline.MaxLines)

	// Generate bounce signals
	signals := analysisservice.GenerateSupportSignals(
		trendlines,
		prepared.Data,
		prepared.Config.Trendline.ProximityDecimal(),
	)

	trendlineDTOs := dto.ToTrendlineDTOs(prepared.Data, trendlines)
	signalDTOs := dto.ToSignalDTOs(signals)

	return trendlineDTOs, signalDTOs, nil
}
