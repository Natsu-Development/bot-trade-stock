package valueobjects

// DivergenceType represents the type of divergence detected
type DivergenceType int

const (
	NoDivergence DivergenceType = iota
	BullishDivergence
	BearishDivergence
)

const (
	Bearish = "bearish"
	Bullish = "bullish"
	None    = "none"
)

// String returns string representation of DivergenceType
func (dt DivergenceType) String() string {
	switch dt {
	case BullishDivergence:
		return Bullish
	case BearishDivergence:
		return Bearish
	default:
		return None
	}
}

// IsBullish returns true if this is a bullish divergence
func (dt DivergenceType) IsBullish() bool {
	return dt == BullishDivergence
}

// IsBearish returns true if this is a bearish divergence
func (dt DivergenceType) IsBearish() bool {
	return dt == BearishDivergence
}

// HasDivergence returns true if there is any divergence detected
func (dt DivergenceType) HasDivergence() bool {
	return dt != NoDivergence
}
