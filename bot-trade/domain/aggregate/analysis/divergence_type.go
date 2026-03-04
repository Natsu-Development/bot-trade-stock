package analysis

// DivergenceType represents the type of divergence detected
type DivergenceType int

const (
	NoDivergence DivergenceType = iota
	BullishDivergence
	BearishDivergence
)

// String returns string representation of DivergenceType
func (dt DivergenceType) String() string {
	switch dt {
	case BullishDivergence:
		return "bullish"
	case BearishDivergence:
		return "bearish"
	default:
		return "none"
	}
}
