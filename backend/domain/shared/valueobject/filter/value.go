// Package filter provides shared immutable value objects for screener filter bounded contexts.
package filter

import (
	"encoding/json"
	"fmt"
)

// BoolToFloat converts boolean to float64 for filter value storage.
// true → 1.0, false → 0.0.
func BoolToFloat(b bool) float64 {
	if b {
		return 1
	}
	return 0
}

// FloatToBool converts float64 to boolean.
// 0 → false, non-zero → true.
func FloatToBool(v float64) bool {
	return v != 0
}

// FilterValue is a filter comparison value that accepts both boolean and numeric JSON.
// Boolean true → 1.0, false → 0.0. It stores natively as a float64 in BSON, so a
// signal rule persists as value:1.0/0.0 while the wire still accepts true/false.
type FilterValue float64

// UnmarshalJSON accepts a JSON boolean, number, or null, coercing bool to 1.0/0.0
// and null to 0.0 (a moving-average rule sends null since it compares price vs MA).
func (v *FilterValue) UnmarshalJSON(data []byte) error {
	// This null → 0 branch is reached ONLY on the direct/non-pointer call path
	// (e.g. TestFilterValue_UnmarshalJSON). During normal struct-field decode of a
	// *FilterValue, Go's encoding/json SKIPS this method for a literal null and
	// leaves the pointer nil — which Condition.validate()'s ErrMissingValue guard
	// relies upon. Do NOT change this to allocate-and-zero on null, or a numeric
	// condition with a missing value would silently match everything again.
	if string(data) == "null" {
		*v = 0
		return nil
	}

	var b bool
	if err := json.Unmarshal(data, &b); err == nil {
		*v = FilterValue(BoolToFloat(b))
		return nil
	}

	var f float64
	if err := json.Unmarshal(data, &f); err != nil {
		return fmt.Errorf("value must be boolean or number: %w", err)
	}
	*v = FilterValue(f)
	return nil
}
