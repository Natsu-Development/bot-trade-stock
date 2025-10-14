package services

import (
	"fmt"
	"sort"

	"bot-trade/internal/domain/entities"
	"bot-trade/internal/domain/valueobjects"
)

// BullishDivergenceDetectorService handles bullish divergence detection
// Following KISS principle: focused only on bullish divergence logic
type BullishDivergenceDetectorService struct {
	pivotDetector *PivotDetectorService
}

// NewBullishDivergenceDetectorService creates a new bullish divergence detector
func NewBullishDivergenceDetectorService(pivotDetector *PivotDetectorService) *BullishDivergenceDetectorService {
	return &BullishDivergenceDetectorService{
		pivotDetector: pivotDetector,
	}
}

// DetectDivergence detects bullish divergence patterns in price and RSI data
func (bdd *BullishDivergenceDetectorService) DetectDivergence(
	priceHistory []*entities.PriceData,
	rsiValues []float64,
) *entities.DivergenceResult {
	// Step 1: Create node map using shared pivot detector
	nodeMap := bdd.pivotDetector.CreatePriceRSINodeMap(priceHistory, rsiValues)

	// Step 2: Find pivot lows (bullish divergence uses pivot lows)
	pivotLows := bdd.pivotDetector.FindRSIPivotLows(nodeMap)

	// Step 3: Analyze pivot lows for bullish divergence
	result := bdd.analyzeBullishDivergence(pivotLows, nodeMap)

	return result
}

// analyzeBullishDivergence analyzes pivot lows for bullish divergence patterns
func (bdd *BullishDivergenceDetectorService) analyzeBullishDivergence(
	pivotLows []entities.PivotPoint,
	nodeMap []*entities.PriceRSINode,
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
	sort.Slice(pivotLows, func(i, j int) bool {
		return pivotLows[i].Index > pivotLows[j].Index
	})

	config := bdd.pivotDetector.GetConfig()

	// Check recent pivot low pairs for bullish divergences
	for i := 0; i < len(pivotLows)-1; i++ {
		current := pivotLows[i]
		previous := pivotLows[i+1]

		// Check if pivots are within acceptable range
		barsBetween := current.Index - previous.Index
		if barsBetween < config.RangeMin || barsBetween > config.RangeMax {
			continue
		}

		// BULLISH DIVERGENCE CHECK
		// Bullish divergence: Price Lower Low + RSI Higher Low
		priceLL := current.Price < previous.Price // Price Lower Low
		rsiHL := current.RSI > previous.RSI       // RSI Higher Low

		if priceLL && rsiHL {
			result.DivergenceFound = true
			result.DivergenceType = valueobjects.BullishDivergence
			result.Description = fmt.Sprintf(
				"Bullish divergence: Price %.2f->%.2f, RSI %.2f->%.2f, Date %s->%s",
				previous.Price, current.Price, previous.RSI, current.RSI,
				previous.Date, current.Date,
			)
			break // Found bullish divergence, stop searching
		}
	}

	return result
}
