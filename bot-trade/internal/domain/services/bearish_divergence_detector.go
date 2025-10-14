package services

import (
	"fmt"
	"sort"

	"bot-trade/internal/domain/entities"
	"bot-trade/internal/domain/valueobjects"
)

// BearishDivergenceDetectorService handles bearish divergence detection
// Following KISS principle: focused only on bearish divergence logic
type BearishDivergenceDetectorService struct {
	pivotDetector *PivotDetectorService
}

// NewBearishDivergenceDetectorService creates a new bearish divergence detector
func NewBearishDivergenceDetectorService(pivotDetector *PivotDetectorService) *BearishDivergenceDetectorService {
	return &BearishDivergenceDetectorService{
		pivotDetector: pivotDetector,
	}
}

// DetectDivergence detects bearish divergence patterns in price and RSI data
func (bdd *BearishDivergenceDetectorService) DetectDivergence(
	priceHistory []*entities.PriceData,
	rsiValues []float64,
) *entities.DivergenceResult {
	// Step 1: Create node map using shared pivot detector
	nodeMap := bdd.pivotDetector.CreatePriceRSINodeMap(priceHistory, rsiValues)

	// Step 2: Find pivot highs (bearish divergence uses pivot highs)
	pivotHighs := bdd.pivotDetector.FindRSIPivotHighs(nodeMap)

	// Step 3: Analyze pivot highs for bearish divergence
	result := bdd.analyzeBearishDivergence(pivotHighs, nodeMap)

	return result
}

// analyzeBearishDivergence analyzes pivot highs for bearish divergence patterns
func (bdd *BearishDivergenceDetectorService) analyzeBearishDivergence(
	pivotHighs []entities.PivotPoint,
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
	sort.Slice(pivotHighs, func(i, j int) bool {
		return pivotHighs[i].Index > pivotHighs[j].Index
	})

	config := bdd.pivotDetector.GetConfig()

	// Check recent pivot high pairs for bearish divergences
	for i := 0; i < len(pivotHighs)-1; i++ {
		current := pivotHighs[i]
		previous := pivotHighs[i+1]

		// Check if pivots are within acceptable range
		barsBetween := current.Index - previous.Index
		if barsBetween < config.RangeMin || barsBetween > config.RangeMax {
			continue
		}

		// BEARISH DIVERGENCE CHECK
		// Bearish divergence: Price Higher High + RSI Lower High
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
			break // Found bearish divergence, stop searching
		}
	}

	return result
}
