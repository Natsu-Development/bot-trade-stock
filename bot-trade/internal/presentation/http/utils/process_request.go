package utils

import (
	"bot-trade/internal/application/dto"
	"bot-trade/internal/domain/valueobjects"
	"errors"

	"github.com/gin-gonic/gin"
)

// ProcessRequest validates request parameters and returns AnalysisRequest DTO
// This helper function validates and converts request parameters to a structured DTO
func ProcessRequest(c *gin.Context) (*dto.AnalysisRequest, error) {
	symbol, err := valueobjects.NewSymbol(c.Param("symbol"))
	if err != nil {
		return nil, err
	}

	// Validate date range format and logic
	dateRange, err := valueobjects.NewDateRange(c.Query("start_date"), c.Query("end_date"))
	if err != nil {
		return nil, err
	}

	// Validate interval format
	interval, err := valueobjects.NewDataInterval(c.Query("interval"))
	if err != nil {
		return nil, err
	}

	// Validate that we have enough data for analysis
	if !dateRange.IsValidForTrading() {
		return nil, errors.New("date range must be at least 14 days for analysis")
	}

	// Return validated request
	return &dto.AnalysisRequest{
		Symbol:    symbol.Value(),
		StartDate: dateRange.StartDateString(),
		EndDate:   dateRange.EndDateString(),
		Interval:  interval.Value(),
	}, nil
}
