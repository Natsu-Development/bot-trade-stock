package services

import (
	"fmt"
	"sort"

	"bot-trade/internal/config"
	"bot-trade/internal/domain/entities"
	"bot-trade/internal/domain/valueobjects"
)

// DivergenceDetectorService handles divergence detection in RSI and price data
type DivergenceDetectorService struct {
	config *config.DivergenceConfig
}

// NewDivergenceDetectorService creates a new divergence detector service with global config
func NewDivergenceDetectorService(cfg *config.Config) *DivergenceDetectorService {
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
	return &DivergenceDetectorService{
		config: divConfig,
	}
}

// 1. PIVOT DETECTION IMPLEMENTATION
// FindRSIPivots detects pivot points in RSI data using lookback periods
func (dd *DivergenceDetectorService) FindRSIPivots(
	nodeMap []*entities.PriceRSINode,
) []entities.PivotPoint {

	var pivots []entities.PivotPoint
	dataLen := len(nodeMap)

	// Need enough data for lookback periods
	if dataLen < dd.config.LookbackLeft+dd.config.LookbackRight+1 {
		return pivots
	}

	// Check each potential pivot point (skip edges due to lookback requirements)
	for i := dd.config.LookbackLeft; i < dataLen; i++ {
		current := nodeMap[i]

		// // Check for PIVOT LOW (trough)
		// if dd.isPivotLow(nodeMap, i, config) {
		// 	pivots = append(pivots, PivotPoint{
		// 		Index:      i,
		// 		Value:      current.RSIValue,
		// 		Price:      current.Price,
		// 		RSI:        current.RSIValue,
		// 		Date:       current.Date,
		// 		IsPeakHigh: false,
		// 	})
		// }

		// Check for PIVOT HIGH (peak)
		if dd.isPivotHigh(nodeMap, i, dd.config) {
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

// isPivotLow checks if index i is a pivot low (RSI trough)
func (dd *DivergenceDetectorService) isPivotLow(
	nodeMap []*entities.PriceRSINode,
	index int,
	config *config.DivergenceConfig,
) bool {

	centerRSI := nodeMap[index].RSIValue
	rightIndex := index + dd.config.LookbackRight
	if rightIndex > len(nodeMap)-1 {
		rightIndex = len(nodeMap) - 1
	}

	// Check all bars to the left
	for i := index - dd.config.LookbackLeft; i < index; i++ {
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

// isPivotHigh checks if index i is a pivot high (RSI peak)
func (dd *DivergenceDetectorService) isPivotHigh(
	nodeMap []*entities.PriceRSINode,
	index int,
	config *config.DivergenceConfig,
) bool {

	centerRSI := nodeMap[index].RSIValue
	rightIndex := index + dd.config.LookbackRight
	if rightIndex > len(nodeMap)-1 {
		rightIndex = len(nodeMap) - 1
	}

	// Check all bars to the left
	for i := index - dd.config.LookbackLeft; i < index; i++ {
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

// createPriceRSINodeMap creates a map of nodes with price, RSI, and time range information
func (dd *DivergenceDetectorService) createPriceRSINodeMap(
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

// 2. SIMPLER 2-POINT COMPARISON IMPLEMENTATION
// DetectDivergence implements the PineScript-style 2-point comparison
func (dd *DivergenceDetectorService) DetectDivergence(priceHistory []*entities.PriceData, rsiValues []float64) *entities.DivergenceResult {
	// Step 1: Create node map
	nodeMap := dd.createPriceRSINodeMap(priceHistory, rsiValues)

	// Step 2: Find pivots using proper lookback periods
	pivots := dd.FindRSIPivots(nodeMap)

	// Step 3: Apply 2-point comparison for recent pivots
	result := dd.compareTwoPivots(pivots, nodeMap, dd.config)

	return result
}

// compareTwoPivots implements the core 2-point comparison logic
func (dd *DivergenceDetectorService) compareTwoPivots(
	pivots []entities.PivotPoint,
	nodeMap []*entities.PriceRSINode,
	config *config.DivergenceConfig,
) *entities.DivergenceResult {

	currentPrice := nodeMap[len(nodeMap)-1].Price
	currentRSI := nodeMap[len(nodeMap)-1].RSIValue

	result := &entities.DivergenceResult{
		CurrentPrice:    currentPrice,
		CurrentRSI:      currentRSI,
		DivergenceFound: false,
		DivergenceType:  valueobjects.NoDivergence,
	}

	// Sort pivots by index (most recent first)
	sort.Slice(pivots, func(i, j int) bool {
		return pivots[i].Index > pivots[j].Index
	})

	// mostRecentIndex := len(nodeMap) - 1

	// Check recent pivot pairs for divergences
	for i := 0; i < len(pivots)-1; i++ {
		current := pivots[i]
		previous := pivots[i+1]

		// // Skip pivots that are more than 20 indices away from the most recent data point
		// if mostRecentIndex-current.Index > 20 || mostRecentIndex-previous.Index > 20 {
		// 	continue
		// }

		// Check if pivots are within acceptable range
		barsBetween := current.Index - previous.Index
		if barsBetween < dd.config.RangeMin || barsBetween > dd.config.RangeMax {
			continue
		}

		// // BULLISH DIVERGENCE CHECK (using pivot lows)
		// if !current.IsPeakHigh { // Both are lows
		// 	priceLL := current.Price < previous.Price // Price Lower Low
		// 	rsiHL := current.RSI > previous.RSI       // RSI Higher Low

		// 	if priceLL && rsiHL {
		// 		result.DivergenceFound = true
		// 		result.DivergenceType = valueobjects.BullishDivergence
		// 		result.Description = fmt.Sprintf(
		// 			"Bullish divergence: Price %.2f->%.2f, RSI %.2f->%.2f, Date %s->%s",
		// 			previous.Price, current.Price, previous.RSI, current.RSI,
		// 			previous.Date, current.Date,
		// 		)
		// 		break
		// 	}
		// }

		// BEARISH DIVERGENCE CHECK (using pivot highs)
		if current.IsPeakHigh { // Both are highs
			priceHH := current.Price > previous.Price // Price Higher High
			rsiLH := current.RSI < previous.RSI       // RSI Lower High

			if priceHH && rsiLH {
				result.DivergenceFound = true
				result.DivergenceType = valueobjects.BearishDivergence
				result.Description = fmt.Sprintf(
					"Bearish divergence: Price %.2f->%.2f, RSI %.2f->%.2f, Date %s->%s",
					previous.Price, current.Price, previous.RSI, current.RSI,
					previous.Date, current.Date,
				)
				break
			}
		}
	}

	return result
}
