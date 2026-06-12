package rsi

import (
	"backend/application/dto"
	appPrep "backend/application/usecase/analyze/prep"
	analysisservice "backend/domain/analysis/service"
	analysisvo "backend/domain/analysis/valueobject"
)

// BullishRSIUseCase detects bullish RSI divergences.
// Pure analysis use case - receives prepared data, no I/O dependencies.
// Used by BullishRSIJob for targeted bullish divergence detection.
type BullishRSIUseCase struct{}

// NewBullishRSIUseCase creates a new bullish RSI use case.
func NewBullishRSIUseCase() *BullishRSIUseCase {
	return &BullishRSIUseCase{}
}

// Execute performs bullish divergence analysis on prepared data.
// Pure analysis - no I/O, receives prepared data directly.
func (uc *BullishRSIUseCase) Execute(prepared *appPrep.DataPrepare) ([]dto.DivergenceDTO, error) {
	pivotPeriod := int(prepared.Config.PivotPeriod)
	pivots := analysisservice.FindLowPivots(prepared.Data, analysisvo.FieldRSI, pivotPeriod)
	divergences := analysisservice.FindBullishDivergences(
		pivots,
		prepared.Config.Divergence.RangeMin,
		prepared.Config.Divergence.RangeMax,
	)
	return dto.ToDivergenceDTOs(divergences), nil
}

// ExecuteEarly performs EARLY (forming) bullish divergence analysis using the current
// bar. Returns an empty slice when no early divergence is forming, so the caller does
// not fire. Independent of Execute (the confirmed path).
func (uc *BullishRSIUseCase) ExecuteEarly(prepared *appPrep.DataPrepare) ([]dto.DivergenceDTO, error) {
	if len(prepared.Data) == 0 {
		return nil, nil
	}
	pivotPeriod := int(prepared.Config.PivotPeriod)
	pivots := analysisservice.FindLowPivots(prepared.Data, analysisvo.FieldRSI, pivotPeriod)
	early := analysisservice.FindEarlyBullishDivergence(pivots, prepared.Data[len(prepared.Data)-1])
	if early.Type == "" {
		return nil, nil
	}
	return dto.ToDivergenceDTOs([]analysisvo.Divergence{early}), nil
}
