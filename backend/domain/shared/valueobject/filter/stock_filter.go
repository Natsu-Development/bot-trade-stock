// Package filter provides shared immutable value objects for screener filter bounded contexts.
// This is part of the Shared Kernel pattern - explicitly shared model elements that
// all contexts agree on and use consistently.
package filter

import marketvo "backend/domain/shared/valueobject/market"

// StockFilter is the flat, two-level screener filter (wire == BSON == domain):
// a top-level Match over Conditions and Groups (each Group is one level of
// Conditions; no sub-groups), with an outer-AND Exchanges list.
type StockFilter struct {
	Match      MatchMode   `json:"match"                bson:"match"`
	Negate     bool        `json:"negate,omitempty"     bson:"negate,omitempty"`
	Conditions []Condition `json:"conditions,omitempty" bson:"conditions,omitempty"`
	Groups     []Group     `json:"groups,omitempty"     bson:"groups,omitempty"`
	Exchanges  []string    `json:"exchanges,omitempty"  bson:"exchanges,omitempty"`
}

// IsEmpty reports whether the filter has no conditions, no groups, and no exchanges.
func (f StockFilter) IsEmpty() bool {
	return len(f.Conditions) == 0 && len(f.Groups) == 0 && len(f.Exchanges) == 0
}

// Validate normalizes empty Match values to MatchAnd (top level + each group),
// validates every condition (field-kind + signal-'=' + value-presence), enforces
// the global condition cap, and validates exchanges. It mutates the receiver to
// persist normalized combinators.
func (f *StockFilter) Validate() error {
	if f.Match == "" {
		f.Match = MatchAnd
	}
	n := 0
	for i := range f.Conditions {
		if err := f.Conditions[i].validate(); err != nil {
			return err
		}
	}
	n += len(f.Conditions)
	for i := range f.Groups {
		gn, err := f.Groups[i].validate()
		if err != nil {
			return err
		}
		n += gn
	}
	if n > MaxFilterConditions {
		return ErrTooManyConditions
	}
	for _, e := range f.Exchanges {
		if _, err := marketvo.NewExchange(e); err != nil {
			return ErrInvalidStockFilter
		}
	}
	return nil
}
