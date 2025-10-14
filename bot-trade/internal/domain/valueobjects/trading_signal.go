package valueobjects

// TradingSignal represents a trading recommendation
type TradingSignal int

const (
	Hold TradingSignal = iota
	Buy
	Sell
)

// String returns string representation of TradingSignal
func (ts TradingSignal) String() string {
	switch ts {
	case Buy:
		return "BUY"
	case Sell:
		return "SELL"
	default:
		return "HOLD"
	}
}

// IsActionable returns true if the signal requires action (not HOLD)
func (ts TradingSignal) IsActionable() bool {
	return ts == Buy || ts == Sell
}

// IsBuy returns true if the signal is a buy signal
func (ts TradingSignal) IsBuy() bool {
	return ts == Buy
}

// IsSell returns true if the signal is a sell signal
func (ts TradingSignal) IsSell() bool {
	return ts == Sell
}
