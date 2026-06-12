// Package filter provides shared immutable value objects for screener filter bounded contexts.
package filter

import "errors"

// MaxFilterConditions is the maximum number of leaf conditions across the whole
// filter (top-level + every group). Defense in depth alongside the body cap.
const MaxFilterConditions = 50

var (
	// ErrSignalOperatorUnsupported is returned when a signal field uses an operator other than "=".
	ErrSignalOperatorUnsupported = errors.New("signal fields only support the '=' operator")
	// ErrMissingValue is returned when a numeric condition omits its value.
	ErrMissingValue = errors.New("numeric filter condition requires a value")
	// ErrMissingOperator is returned when a numeric or moving-average condition omits its operator.
	ErrMissingOperator = errors.New("filter condition requires an operator")
	// ErrNumericEqualityUnsupported is returned when an integer-valued numeric
	// condition uses '='. Even integers rarely benefit from exact-equality
	// screening, so '=' is a silent always-false footgun — integer fields require
	// an ordering operator (>, >=, <, <=).
	ErrNumericEqualityUnsupported = errors.New("numeric filter conditions require an ordering operator (>, >=, <, <=); '=' is not allowed for numbers")
	// ErrFloatOperatorUnsupported is returned when a continuous-float field (price,
	// % change, volume-vs-SMA, the EMA/SMA moving averages) uses an operator other
	// than a strict inequality. A float never lands exactly on a threshold, so
	// '>=' / '<=' / '=' add nothing over '>' / '<' — only strict >/< are allowed.
	ErrFloatOperatorUnsupported = errors.New("float filter fields (price, % change, vol×SMA, moving averages) require a strict inequality (>, <)")
	// ErrTooManyConditions is returned when the filter exceeds MaxFilterConditions.
	ErrTooManyConditions = errors.New("filter exceeds maximum number of conditions")
	// ErrInvalidStockFilter is returned when stock filter validation fails (e.g. bad exchange).
	ErrInvalidStockFilter = errors.New("invalid stock filter")
	// ErrFieldComparisonField is returned when a field-vs-field comparison uses a
	// non-price/MA field on either side, or compares a field against itself.
	ErrFieldComparisonField = errors.New("field comparison requires two distinct price or moving-average fields")
	// ErrFieldComparisonOperator is returned when a field-vs-field comparison uses
	// an operator other than a strict inequality. Both sides are price/MA floats,
	// which never land exactly equal, so only > and < are allowed.
	ErrFieldComparisonOperator = errors.New("field comparison requires a strict inequality (>, <)")
	// ErrUnexpectedValue is returned when a field-vs-field comparison carries a Value
	// (the right-hand side is a field, so no literal value is allowed).
	ErrUnexpectedValue = errors.New("field comparison must not include a value")
	// ErrMovingAverageRequiresComparison is returned for a bare moving-average leaf
	// (an MA field with no RhsField). A moving average is only meaningful compared to
	// price or another MA, so it must use the field-comparison form.
	ErrMovingAverageRequiresComparison = errors.New("moving-average fields must be compared to price or another moving average")
)
