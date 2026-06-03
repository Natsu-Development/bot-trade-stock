// Package filter — shared screener filter value objects (Shared Kernel).
package filter

import (
	"encoding/json"
	"errors"
	"strings"
)

// ErrInvalidMatchMode is returned when a match mode is neither "and" nor "or".
var ErrInvalidMatchMode = errors.New("match must be either 'and' or 'or'")

// MatchMode is the logical combinator for a scope (top level or a group):
// "and" = AND, "or" = OR.
type MatchMode string

// Valid match modes.
const (
	MatchAnd MatchMode = "and"
	MatchOr  MatchMode = "or"
)

// NewMatchMode validates and normalizes a match mode string.
func NewMatchMode(value string) (MatchMode, error) {
	m := MatchMode(strings.ToLower(strings.TrimSpace(value)))
	if m != MatchAnd && m != MatchOr {
		return "", ErrInvalidMatchMode
	}
	return m, nil
}

// MarshalJSON implements json.Marshaler for MatchMode.
func (m MatchMode) MarshalJSON() ([]byte, error) { return json.Marshal(string(m)) }

// UnmarshalJSON implements json.Unmarshaler for MatchMode with validation.
func (m *MatchMode) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	mode, err := NewMatchMode(s)
	if err != nil {
		return err
	}
	*m = mode
	return nil
}
