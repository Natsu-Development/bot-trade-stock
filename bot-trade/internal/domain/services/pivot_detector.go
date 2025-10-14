package services

import (
	"bot-trade/internal/config"
	"bot-trade/internal/domain/entities"
)

// PivotDetectorService handles pivot point detection in RSI and price data
// This is the shared service for both bullish and bearish divergence detection
type PivotDetectorService struct {
	config *config.DivergenceConfig
}

// NewPivotDetectorService creates a new pivot detector service
func NewPivotDetectorService(cfg *config.Config) *PivotDetectorService {
	divConfig, err := config.NewDivergenceConfig(cfg)
	if err != nil {
		// This should not happen if config validation passed
		// Fall back to unvalidated config for backward compatibility
		divConfig = &config.DivergenceConfig{
			LookbackLeft:  cfg.DivergenceLookbackLeft,
			LookbackRight: cfg.DivergenceLookbackRight,
			RangeMin:      cfg.DivergenceRangeMin,
			RangeMax:      cfg.DivergenceRangeMax,
		}
	}
	return &PivotDetectorService{
		config: divConfig,
	}
}

// FindRSIPivotHighs detects pivot high points in RSI data
func (pd *PivotDetectorService) FindRSIPivotHighs(nodeMap []*entities.PriceRSINode) []entities.PivotPoint {
	var pivots []entities.PivotPoint
	dataLen := len(nodeMap)

	// Need enough data for lookback periods
	if dataLen < pd.config.LookbackLeft+pd.config.LookbackRight+1 {
		return pivots
	}

	// Check each potential pivot point (skip edges due to lookback requirements)
	for i := pd.config.LookbackLeft; i < dataLen; i++ {
		current := nodeMap[i]

		// Check for PIVOT HIGH (peak)
		if pd.isPivotHigh(nodeMap, i) {
			pivots = append(pivots, entities.PivotPoint{
				Index:      i,
				Value:      current.RSIValue,
				Price:      current.Price,
				RSI:        current.RSIValue,
				Date:       current.Date,
				IsPeakHigh: true,
			})
		}
	}

	return pivots
}

// FindRSIPivotLows detects pivot low points in RSI data
func (pd *PivotDetectorService) FindRSIPivotLows(nodeMap []*entities.PriceRSINode) []entities.PivotPoint {
	var pivots []entities.PivotPoint
	dataLen := len(nodeMap)

	// Need enough data for lookback periods
	if dataLen < pd.config.LookbackLeft+pd.config.LookbackRight+1 {
		return pivots
	}

	// Check each potential pivot point (skip edges due to lookback requirements)
	for i := pd.config.LookbackLeft; i < dataLen; i++ {
		current := nodeMap[i]

		// Check for PIVOT LOW (trough)
		if pd.isPivotLow(nodeMap, i) {
			pivots = append(pivots, entities.PivotPoint{
				Index:      i,
				Value:      current.RSIValue,
				Price:      current.Price,
				RSI:        current.RSIValue,
				Date:       current.Date,
				IsPeakHigh: false,
			})
		}
	}

	return pivots
}

// CreatePriceRSINodeMap creates a map of nodes with price, RSI, and time information
func (pd *PivotDetectorService) CreatePriceRSINodeMap(
	priceHistory []*entities.PriceData,
	rsiValues []float64,
) []*entities.PriceRSINode {
	minLen := len(priceHistory)
	if len(rsiValues) < minLen {
		minLen = len(rsiValues)
	}

	nodes := make([]*entities.PriceRSINode, minLen)

	for i := 0; i < minLen; i++ {
		nodes[i] = &entities.PriceRSINode{
			Index:          i,
			Date:           priceHistory[i].Date(),
			Price:          priceHistory[i].Close().Value(),
			RSIValue:       rsiValues[i],
			IsOptimalPoint: false,
		}
	}

	return nodes
}

// GetConfig returns the pivot detector configuration
func (pd *PivotDetectorService) GetConfig() *config.DivergenceConfig {
	return pd.config
}

// isPivotHigh checks if index i is a pivot high (RSI peak)
func (pd *PivotDetectorService) isPivotHigh(nodeMap []*entities.PriceRSINode, index int) bool {
	centerRSI := nodeMap[index].RSIValue
	rightIndex := index + pd.config.LookbackRight
	if rightIndex > len(nodeMap)-1 {
		rightIndex = len(nodeMap) - 1
	}

	// Check all bars to the left
	for i := index - pd.config.LookbackLeft; i < index; i++ {
		if nodeMap[i].RSIValue >= centerRSI {
			return false // Not higher than left side
		}
	}

	// Check all bars to the right
	for i := index + 1; i <= rightIndex; i++ {
		if nodeMap[i].RSIValue >= centerRSI {
			return false // Not higher than right side
		}
	}

	return true // Higher than all surrounding bars
}

// isPivotLow checks if index i is a pivot low (RSI trough)
func (pd *PivotDetectorService) isPivotLow(nodeMap []*entities.PriceRSINode, index int) bool {
	centerRSI := nodeMap[index].RSIValue
	rightIndex := index + pd.config.LookbackRight
	if rightIndex > len(nodeMap)-1 {
		rightIndex = len(nodeMap) - 1
	}

	// Check all bars to the left
	for i := index - pd.config.LookbackLeft; i < index; i++ {
		if nodeMap[i].RSIValue <= centerRSI {
			return false // Not lower than left side
		}
	}

	// Check all bars to the right
	for i := index + 1; i <= rightIndex; i++ {
		if nodeMap[i].RSIValue <= centerRSI {
			return false // Not lower than right side
		}
	}

	return true // Lower than all surrounding bars
}
