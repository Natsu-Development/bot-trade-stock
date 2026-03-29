package trendline

import (
	"bot-trade/application/dto"
	analysisservice "bot-trade/domain/analysis/service"
	analysisvo "bot-trade/domain/analysis/valueobject"
	appPrep "bot-trade/application/usecase/analyze/prep"
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
func (uc *BreakoutUseCase) Execute(data *appPrep.DataPrepare) ([]dto.TrendlineDTO, []dto.SignalDTO, error) {
	// Call domain services directly
	pivotPeriod := int(data.Config.PivotPeriod)

	// Find price high pivots for resistance trendlines
	priceHighPivots := analysisservice.FindHighPivots(data.DataRecent, analysisvo.FieldHigh, pivotPeriod)

	// Build resistance trendlines
	trendlines := analysisservice.BuildResistanceTrendlines(priceHighPivots, data.Config.Trendline.MaxLines)

	// Generate breakout signals
	signals := analysisservice.GenerateResistanceSignals(
		trendlines,
		data.DataRecent,
		data.Config.Trendline.ProximityDecimal(),
	)

	trendlineDTOs := dto.ToTrendlineDTOs(data.DataRecent, trendlines)
	signalDTOs := dto.ToSignalDTOs(signals)

	return trendlineDTOs, signalDTOs, nil
}
