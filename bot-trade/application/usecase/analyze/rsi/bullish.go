package rsi

import (
	"bot-trade/application/dto"
	analysisservice "bot-trade/domain/analysis/service"
	analysisvo "bot-trade/domain/analysis/valueobject"
	appPrep "bot-trade/application/usecase/analyze/prep"
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
func (uc *BullishRSIUseCase) Execute(data *appPrep.DataPrepare) ([]dto.DivergenceDTO, error) {
	pivotPeriod := int(data.Config.PivotPeriod)
	pivots := analysisservice.FindLowPivots(data.DataRecent, analysisvo.FieldRSI, pivotPeriod)
	divergences := analysisservice.FindBullishDivergences(
		pivots,
		data.Config.Divergence.RangeMin,
		data.Config.Divergence.RangeMax,
	)
	return dto.ToDivergenceDTOs(divergences), nil
}
