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
	// ErrTooManyConditions is returned when the filter exceeds MaxFilterConditions.
	ErrTooManyConditions = errors.New("filter exceeds maximum number of conditions")
	// ErrInvalidStockFilter is returned when stock filter validation fails (e.g. bad exchange).
	ErrInvalidStockFilter = errors.New("invalid stock filter")
)
