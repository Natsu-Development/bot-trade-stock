package rsi

import (
	"bot-trade/application/dto"
	analysisservice "bot-trade/domain/analysis/service"
	analysisvo "bot-trade/domain/analysis/valueobject"
	appPrep "bot-trade/application/usecase/analyze/prep"
)

// BearishRSIUseCase detects bearish RSI divergences.
// Pure analysis use case - receives prepared data, no I/O dependencies.
// Used by BearishRSIJob for targeted bearish divergence detection.
type BearishRSIUseCase struct{}

// NewBearishRSIUseCase creates a new bearish RSI use case.
func NewBearishRSIUseCase() *BearishRSIUseCase {
	return &BearishRSIUseCase{}
}

// Execute performs bearish divergence analysis on prepared data.
// Pure analysis - no I/O, receives prepared data directly.
func (uc *BearishRSIUseCase) Execute(data *appPrep.DataPrepare) ([]dto.DivergenceDTO, error) {
	isEarly := data.Config.BearishEarly != nil && *data.Config.BearishEarly
	pivotPeriod := int(data.Config.PivotPeriod)
	pivots := analysisservice.FindHighPivots(data.DataRecent, analysisvo.FieldRSI, pivotPeriod)

	if isEarly {
		earlyDivergence := analysisservice.FindEarlyBearishDivergence(
			pivots,
			data.DataRecent[len(data.DataRecent)-1],
		)
		return dto.ToDivergenceDTOs([]analysisvo.Divergence{earlyDivergence}), nil
	}

	divergences := analysisservice.FindBearishDivergences(
		pivots,
		data.Config.Divergence.RangeMin,
		data.Config.Divergence.RangeMax,
	)
	return dto.ToDivergenceDTOs(divergences), nil
}
