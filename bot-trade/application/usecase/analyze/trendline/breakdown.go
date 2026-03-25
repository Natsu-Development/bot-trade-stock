package trendline

import (
	"bot-trade/application/dto"
	analysisservice "bot-trade/domain/analysis/service"
	analysisvo "bot-trade/domain/analysis/valueobject"
	appPrep "bot-trade/application/usecase/analyze/prep"
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
func (uc *BreakdownUseCase) Execute(data *appPrep.DataPrepare) ([]dto.TrendlineDTO, []dto.SignalDTO, error) {
	// Call domain services directly
	pivotPeriod := int(data.Config.PivotPeriod)

	// Find price low pivots for support trendlines
	priceLowPivots := analysisservice.FindLowPivots(data.DataRecent, analysisvo.FieldLow, pivotPeriod)

	// Build support trendlines
	trendlines := analysisservice.BuildSupportTrendlines(priceLowPivots, data.Config.Trendline.MaxLines)

	// Generate bounce signals
	signals := analysisservice.GenerateSupportSignals(
		trendlines,
		data.DataRecent,
		data.Config.Trendline.ProximityPercent,
	)

	trendlineDTOs := dto.ToTrendlineDTOs(data.DataRecent, trendlines)
	signalDTOs := dto.ToSignalDTOs(signals)

	return trendlineDTOs, signalDTOs, nil
}
