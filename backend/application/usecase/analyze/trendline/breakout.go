package trendline

import (
	"backend/application/dto"
	appPrep "backend/application/usecase/analyze/prep"
	analysisservice "backend/domain/analysis/service"
	analysisvo "backend/domain/analysis/valueobject"
)

// BreakoutUseCase detects resistance trendline signals.
// Pure analysis use case - receives prepared data, no I/O dependencies.
// Used for detecting potential breakout signals from resistance trendlines.
type BreakoutUseCase struct{}

// NewBreakoutUseCase creates a new breakout use case.
func NewBreakoutUseCase() *BreakoutUseCase {
	return &BreakoutUseCase{}
}

// Execute performs resistance trendline analysis on prepared data.
// Pure analysis - no I/O, receives prepared data directly.
// Detects Breakout signals from resistance trendlines.
func (uc *BreakoutUseCase) Execute(prepared *appPrep.DataPrepare) ([]dto.TrendlineDTO, []dto.SignalDTO, error) {
	// Call domain services directly
	pivotPeriod := int(prepared.Config.PivotPeriod)

	// Find price high pivots for resistance trendlines
	priceHighPivots := analysisservice.FindHighPivots(prepared.Data, analysisvo.FieldHigh, pivotPeriod)

	// Build resistance trendlines
	trendlines := analysisservice.BuildResistanceTrendlines(priceHighPivots, prepared.Config.Trendline.MaxLines)

	// Generate breakout signals
	signals := analysisservice.GenerateResistanceSignals(
		trendlines,
		prepared.Data,
		prepared.Config.Trendline.ProximityDecimal(),
	)

	trendlineDTOs := dto.ToTrendlineDTOs(prepared.Data, trendlines)
	signalDTOs := dto.ToSignalDTOs(signals)

	return trendlineDTOs, signalDTOs, nil
}
