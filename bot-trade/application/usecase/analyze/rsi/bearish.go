package rsi

import (
	"bot-trade/application/dto"
	appPrep "bot-trade/application/usecase/analyze/prep"
	analysisservice "bot-trade/domain/analysis/service"
	analysisvo "bot-trade/domain/analysis/valueobject"
)

// BearishRSIUseCase detects bearish RSI divergences.
// Pure analysis use case - receives prepared data, no I/O dependencies.
// Used by BearishRSIJob for targeted bearish divergence detection.
type BearishRSIUseCase struct{}

// NewBearishRSIUseCase creates a new bearish RSI use case.
func NewBearishRSIUseCase() *BearishRSIUseCase {
	return &BearishRSIUseCase{}
}

// Execute performs CONFIRMED bearish divergence analysis on prepared data.
// Pure analysis - no I/O, receives prepared data directly.
func (uc *BearishRSIUseCase) Execute(data *appPrep.DataPrepare) ([]dto.DivergenceDTO, error) {
	pivotPeriod := int(data.Config.PivotPeriod)
	pivots := analysisservice.FindHighPivots(data.DataRecent, analysisvo.FieldRSI, pivotPeriod)
	divergences := analysisservice.FindBearishDivergences(
		pivots,
		data.Config.Divergence.RangeMin,
		data.Config.Divergence.RangeMax,
	)
	return dto.ToDivergenceDTOs(divergences), nil
}

// ExecuteEarly performs EARLY (forming) bearish divergence analysis using the current
// bar. Returns an empty slice when no early divergence is forming, so the caller does
// not fire. Independent of Execute (the confirmed path).
func (uc *BearishRSIUseCase) ExecuteEarly(data *appPrep.DataPrepare) ([]dto.DivergenceDTO, error) {
	if len(data.DataRecent) == 0 {
		return nil, nil
	}
	pivotPeriod := int(data.Config.PivotPeriod)
	pivots := analysisservice.FindHighPivots(data.DataRecent, analysisvo.FieldRSI, pivotPeriod)
	early := analysisservice.FindEarlyBearishDivergence(pivots, data.DataRecent[len(data.DataRecent)-1])
	if early.Type == "" {
		return nil, nil
	}
	return dto.ToDivergenceDTOs([]analysisvo.Divergence{early}), nil
}
