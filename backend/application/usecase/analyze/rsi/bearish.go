package rsi

import (
	"backend/application/dto"
	appPrep "backend/application/usecase/analyze/prep"
	analysisservice "backend/domain/analysis/service"
	analysisvo "backend/domain/analysis/valueobject"
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
func (uc *BearishRSIUseCase) Execute(prepared *appPrep.DataPrepare) ([]dto.DivergenceDTO, error) {
	pivotPeriod := int(prepared.Config.PivotPeriod)
	pivots := analysisservice.FindHighPivots(prepared.Data, analysisvo.FieldRSI, pivotPeriod)
	divergences := analysisservice.FindBearishDivergences(
		pivots,
		prepared.Config.Divergence.RangeMin,
		prepared.Config.Divergence.RangeMax,
	)
	return dto.ToDivergenceDTOs(divergences), nil
}

// ExecuteEarly performs EARLY (forming) bearish divergence analysis using the current
// bar. Returns an empty slice when no early divergence is forming, so the caller does
// not fire. Independent of Execute (the confirmed path).
func (uc *BearishRSIUseCase) ExecuteEarly(prepared *appPrep.DataPrepare) ([]dto.DivergenceDTO, error) {
	if len(prepared.Data) == 0 {
		return nil, nil
	}
	pivotPeriod := int(prepared.Config.PivotPeriod)
	pivots := analysisservice.FindHighPivots(prepared.Data, analysisvo.FieldRSI, pivotPeriod)
	early := analysisservice.FindEarlyBearishDivergence(pivots, prepared.Data[len(prepared.Data)-1])
	if early.Type == "" {
		return nil, nil
	}
	return dto.ToDivergenceDTOs([]analysisvo.Divergence{early}), nil
}
