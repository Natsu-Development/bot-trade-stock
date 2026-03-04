// Package aggregate provides shared domain types and errors used across aggregates.
package aggregate

// ValidationError contains multiple validation errors.
// This is a shared domain error type used across aggregates.
type ValidationError struct {
	Field  string   // Optional field name for context
	Errors []string // Validation error messages
}

// Error returns a formatted error string.
func (e *ValidationError) Error() string {
	if len(e.Errors) == 0 {
		return "validation failed"
	}
	if len(e.Errors) == 1 {
		if e.Field != "" {
			return e.Field + ": " + e.Errors[0]
		}
		return e.Errors[0]
	}
	result := "validation errors"
	if e.Field != "" {
		result = e.Field + " validation errors"
	}
	for i, err := range e.Errors {
		if i > 0 {
			result += "; "
		}
		result += err
	}
	return result
}

// NewValidationError creates a new ValidationError.
func NewValidationError(errors ...string) *ValidationError {
	return &ValidationError{Errors: errors}
}

// NewFieldValidationError creates a field-specific ValidationError.
func NewFieldValidationError(field string, errors ...string) *ValidationError {
	return &ValidationError{Field: field, Errors: errors}
}
