// Package filter provides shared immutable value objects for screener filter bounded contexts.
// This is part of the Shared Kernel pattern - explicitly shared model elements that
// all contexts agree on and use consistently.
package filter

import (
	"errors"

	marketvo "bot-trade/domain/shared/valueobject/market"
)

var (
	// ErrInvalidStockFilter is returned when stock filter validation fails.
	ErrInvalidStockFilter = errors.New("invalid stock filter")
)

// StockFilter represents runtime filter criteria for stock screening.
// Logic defaults to AND if empty.
// Use NewStockFilter factory method for validation.
type StockFilter struct {
	Conditions []FilterCondition `json:"filters"`
	Logic      FilterLogic       `json:"logic"` // "and" or "or"
	Exchanges  []string          `json:"exchanges,omitempty"`
}

// NewStockFilter creates a validated stock filter.
// FilterConditions are already validated via NewFilterCondition(), so we only validate logic and exchanges here.
func NewStockFilter(conditions []FilterCondition, logic string, exchanges []string) (*StockFilter, error) {
	// Validate logic (defaults to AND if empty)
	filterLogic, err := Validate(logic)
	if err != nil && logic != "" {
		return nil, ErrInvalidStockFilter
	}
	if logic == "" {
		filterLogic = LogicAND // Default
	}

	// Validate exchanges
	for _, e := range exchanges {
		if _, err := marketvo.NewExchange(e); err != nil {
			return nil, ErrInvalidStockFilter
		}
	}

	return &StockFilter{
		Conditions: conditions,
		Logic:      filterLogic,
		Exchanges:  exchanges,
	}, nil
}

// IsEmpty returns true if the filter has no conditions or exchanges.
func (sf *StockFilter) IsEmpty() bool {
	return len(sf.Conditions) == 0 && len(sf.Exchanges) == 0
}
