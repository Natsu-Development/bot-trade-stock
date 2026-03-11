// Package filter provides shared immutable value objects for screener filter bounded contexts.
// This is part of the Shared Kernel pattern - explicitly shared model elements that
// all contexts agree on and use consistently.
package filter

import (
	"encoding/json"
	"errors"
	"fmt"

	marketvo "bot-trade/domain/shared/valueobject/market"
)

var (
	// ErrInvalidStockFilter is returned when stock filter validation fails.
	ErrInvalidStockFilter = errors.New("invalid stock filter")
)

// StockFilter represents runtime filter criteria for stock screening.
// Logic defaults to AND if empty.
// JSON unmarshaling validates all values including logic and exchanges.
type StockFilter struct {
	Conditions []FilterCondition `json:"filters"`
	Logic      FilterLogic       `json:"logic"` // "and" or "or"
	Exchanges  []string          `json:"exchanges,omitempty"`
}

// UnmarshalJSON implements json.Unmarshaler for StockFilter with validation.
func (sf *StockFilter) UnmarshalJSON(b []byte) error {
	type Alias StockFilter // Prevent recursion
	var raw struct {
		Filters   []json.RawMessage `json:"filters"`
		Logic     string           `json:"logic"`
		Exchanges []string         `json:"exchanges,omitempty"`
	}

	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}

	// Unmarshal and validate each condition
	conditions := make([]FilterCondition, len(raw.Filters))
	for i, fcBytes := range raw.Filters {
		var cond FilterCondition
		if err := json.Unmarshal(fcBytes, &cond); err != nil {
			return fmt.Errorf("invalid filter at index %d: %w", i, err)
		}
		conditions[i] = cond
	}

	// Validate logic (defaults to AND if empty)
	filterLogic, err := Validate(raw.Logic)
	if err != nil && raw.Logic != "" {
		return fmt.Errorf("invalid logic: %w", err)
	}
	if raw.Logic == "" {
		filterLogic = LogicAND // Default
	}

	// Validate exchanges
	for _, e := range raw.Exchanges {
		if _, err := marketvo.NewExchange(e); err != nil {
			return fmt.Errorf("invalid exchange '%s': %w", e, err)
		}
	}

	sf.Conditions = conditions
	sf.Logic = filterLogic
	sf.Exchanges = raw.Exchanges
	return nil
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
